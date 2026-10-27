-- Seat-scoped canonical snapshots and private command results.
-- Run after match-authority-v1.sql through match-authority-v4.sql.

CREATE OR REPLACE FUNCTION public.redact_match_card_array(p_cards jsonb, p_side text, p_zone text, p_hide_all boolean)
RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(
    CASE WHEN p_hide_all OR item->>'faceDown' = 'true' THEN
      jsonb_build_object('uid', 'hidden-' || p_side || '-' || p_zone || '-' || (ordinality - 1), 'cardId', NULL, 'faceDown', true)
    ELSE item END ORDER BY ordinality
  ), '[]'::jsonb)
  FROM jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) WITH ORDINALITY AS cards(item, ordinality)
$$;

CREATE OR REPLACE FUNCTION public.get_match_state_for_player(p_room_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF jsonb_typeof(projected->'pendingAbilities') = 'array' THEN
    SELECT coalesce(jsonb_agg(item ORDER BY ordinality), '[]'::jsonb) INTO pending
      FROM jsonb_array_elements(projected->'pendingAbilities') WITH ORDINALITY AS queue(item, ordinality)
      WHERE coalesce(item->>'side', CASE WHEN item->>'triggerControllerPlayerId' = own_player_id THEN own_side ELSE '' END) = own_side;
    projected := jsonb_set(projected, '{pendingAbilities}', pending, true);
  END IF;
  RETURN jsonb_build_object('ok', true, 'stateVersion', canonical.state_version, 'state', projected);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_match_action_result(p_room_code text, p_action_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE room public.match_rooms%ROWTYPE; command public.match_action_commands%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Signed-in match identity required'; END IF;
  SELECT * INTO room FROM public.match_rooms WHERE room_code = upper(p_room_code);
  IF NOT FOUND OR auth.uid() IS DISTINCT FROM room.host_auth_uid AND auth.uid() IS DISTINCT FROM room.guest_auth_uid THEN
    RAISE EXCEPTION 'Player is not seated in this room';
  END IF;
  SELECT * INTO command FROM public.match_action_commands
    WHERE room_code = room.room_code AND action_id = p_action_id AND actor_auth_uid = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'action-not-found'); END IF;
  RETURN jsonb_build_object('ok', true, 'actionId', command.action_id, 'status', command.status,
    'stateVersion', command.expected_state_version, 'result', command.result);
END;
$$;

REVOKE ALL ON FUNCTION public.redact_match_card_array(jsonb, text, text, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_match_state_for_player(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_match_action_result(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_state_for_player(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_action_result(text, text) TO authenticated;
