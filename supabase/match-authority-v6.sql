-- Keep opponent-owned effect choices private in seat-scoped snapshots.
-- Run after match-authority-v1.sql through match-authority-v5.sql.

CREATE OR REPLACE FUNCTION public.get_match_state_for_player(p_room_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  room public.match_rooms%ROWTYPE;
  canonical public.match_game_states%ROWTYPE;
  own_side text;
  opponent_side text;
  own_player_id text;
  players jsonb;
  opponent jsonb;
  projected jsonb;
  pending jsonb;
  zone_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Signed-in match identity required'; END IF;
  SELECT * INTO room FROM public.match_rooms WHERE room_code = upper(p_room_code);
  IF NOT FOUND OR auth.uid() IS DISTINCT FROM room.host_auth_uid AND auth.uid() IS DISTINCT FROM room.guest_auth_uid THEN
    RAISE EXCEPTION 'Player is not seated in this room';
  END IF;
  own_side := CASE WHEN auth.uid() = room.host_auth_uid THEN 'human' ELSE 'bot' END;
  opponent_side := CASE WHEN own_side = 'human' THEN 'bot' ELSE 'human' END;
  SELECT * INTO canonical FROM public.match_game_states WHERE room_code = room.room_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'match-not-initialized'); END IF;
  players := canonical.state->'players';
  own_player_id := players->own_side->>'playerId';
  IF own_player_id IS NULL OR jsonb_typeof(players->opponent_side) <> 'object' THEN RAISE EXCEPTION 'Canonical player mapping is invalid'; END IF;

  opponent := players->opponent_side;
  FOREACH zone_name IN ARRAY ARRAY['hand','deck','gDeck'] LOOP
    opponent := jsonb_set(opponent, ARRAY[zone_name], public.redact_match_card_array(opponent -> (zone_name), opponent_side, zone_name, true), true);
  END LOOP;
  opponent := jsonb_set(opponent, '{damage}', public.redact_match_card_array(opponent->'damage', opponent_side, 'damage', false), true);
  players := jsonb_set(players, ARRAY[opponent_side], opponent, true);
  projected := jsonb_set(canonical.state, '{players}', players, true);

  FOREACH zone_name IN ARRAY ARRAY['pendingAbility','pendingStride','pendingProtectGuard','pendingTrigger','pendingCrest','pendingGAssist'] LOOP
    pending := projected->zone_name;
    IF jsonb_typeof(pending) = 'object' THEN
      IF coalesce(pending->>'side', pending->>'ownerSide', '') <> own_side THEN
        projected := jsonb_set(projected, ARRAY[zone_name], 'null'::jsonb, true);
      END IF;
    END IF;
  END LOOP;

  -- The opponent-discard choice belongs to the chooser, not the ability controller.
  pending := projected->'pendingEffectChoice';
  IF jsonb_typeof(pending) = 'object' AND coalesce(pending->>'chooserSide', '') <> own_side THEN
    projected := jsonb_set(projected, '{pendingEffectChoice}', 'null'::jsonb, true);
  END IF;

  IF jsonb_typeof(projected->'pendingAbilities') = 'array' THEN
    SELECT coalesce(jsonb_agg(item ORDER BY ordinality), '[]'::jsonb) INTO pending
      FROM jsonb_array_elements(projected->'pendingAbilities') WITH ORDINALITY AS queue(item, ordinality)
      WHERE coalesce(item->>'side', CASE WHEN item->>'triggerControllerPlayerId' = own_player_id THEN own_side ELSE '' END) = own_side;
    projected := jsonb_set(projected, '{pendingAbilities}', pending, true);
  END IF;
  RETURN jsonb_build_object('ok', true, 'stateVersion', canonical.state_version, 'state', projected);
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_state_for_player(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_state_for_player(text) TO authenticated;
