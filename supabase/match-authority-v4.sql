-- Trusted match initialization needs a server-held catalog with explicit
-- redistribution authorization. Run after authority v1-v3 migrations.

CREATE TABLE IF NOT EXISTS public.match_card_definitions (
  card_id text PRIMARY KEY CHECK (card_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  catalog_version text NOT NULL CHECK (length(catalog_version) BETWEEN 1 AND 80),
  source_name text NOT NULL CHECK (length(source_name) BETWEEN 1 AND 160),
  source_reference text NOT NULL CHECK (length(source_reference) BETWEEN 1 AND 1000),
  license_name text NOT NULL CHECK (length(license_name) BETWEEN 1 AND 160),
  license_reference text NOT NULL CHECK (length(license_reference) BETWEEN 1 AND 1000),
  redistribution_authorized boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (definition->>'id' = card_id)
);

ALTER TABLE public.match_card_definitions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_card_definitions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.match_card_definitions TO service_role;

CREATE OR REPLACE FUNCTION public.get_match_card_definitions(p_card_ids text[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Trusted match initializer required'; END IF;
  IF p_card_ids IS NULL OR cardinality(p_card_ids) < 1 OR cardinality(p_card_ids) > 600
    OR EXISTS (SELECT 1 FROM unnest(p_card_ids) AS id WHERE id !~ '^[A-Za-z0-9_.:-]{1,128}$') THEN
    RAISE EXCEPTION 'Invalid card definition request';
  END IF;
  IF (SELECT count(DISTINCT id) FROM unnest(p_card_ids) AS id) <> cardinality(p_card_ids) THEN
    RAISE EXCEPTION 'Duplicate card definition request';
  END IF;
  IF (SELECT count(*) FROM public.match_card_definitions
      WHERE card_id = ANY(p_card_ids) AND redistribution_authorized) <> cardinality(p_card_ids) THEN
    RAISE EXCEPTION 'Authorized card catalog is incomplete';
  END IF;
  SELECT jsonb_agg(definition ORDER BY card_id) INTO result
    FROM public.match_card_definitions WHERE card_id = ANY(p_card_ids) AND redistribution_authorized;
  RETURN coalesce(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.match_player_state_matches_deck(p_player_state jsonb, p_deck jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE entry record; expected_total integer := 0; actual_total integer := 0; actual_count integer;
BEGIN
  IF jsonb_typeof(p_player_state) <> 'object' OR jsonb_typeof(p_deck->'cards') <> 'object'
    OR jsonb_typeof(p_player_state->'vanguard') <> 'object' THEN RETURN false; END IF;
  FOR entry IN SELECT key, (value #>> '{}')::integer AS quantity FROM jsonb_each(p_deck->'cards') LOOP
    expected_total := expected_total + entry.quantity;
    SELECT count(*) INTO actual_count FROM (
      SELECT p_player_state->'vanguard' AS instance
      UNION ALL
      SELECT zone.instance
      FROM unnest(ARRAY['deck','hand','damage','drop','soul','bind','rear','orders','crests','guardCircle','extra','gDeck','gZone','removed']) AS names(zone_name)
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(p_player_state -> (names.zone_name), '[]'::jsonb)) AS zone(instance)
    ) AS instances WHERE instance->>'cardId' = entry.key;
    IF actual_count <> entry.quantity THEN RETURN false; END IF;
  END LOOP;
  SELECT count(*) INTO actual_total FROM (
    SELECT p_player_state->'vanguard' AS instance
    UNION ALL
    SELECT zone.instance
    FROM unnest(ARRAY['deck','hand','damage','drop','soul','bind','rear','orders','crests','guardCircle','extra','gDeck','gZone','removed']) AS names(zone_name)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(p_player_state -> (names.zone_name), '[]'::jsonb)) AS zone(instance)
  ) AS instances WHERE jsonb_typeof(instance) = 'object' AND instance ? 'cardId';
  RETURN actual_total = expected_total;
END;
$$;

REVOKE ALL ON FUNCTION public.match_player_state_matches_deck(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Reading submissions does not lock them. The initializer rechecks exact deck
-- contents while holding the room lock, then locks both submissions atomically.
CREATE OR REPLACE FUNCTION public.claim_match_decks_for_initialization(p_room_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE room public.match_rooms%ROWTYPE; host_deck jsonb; guest_deck jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Trusted match initializer required'; END IF;
  SELECT * INTO room FROM public.match_rooms WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF NOT FOUND OR room.host_auth_uid IS NULL OR room.guest_auth_uid IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'ready', false, 'reason', 'room-seats-not-ready');
  END IF;
  IF EXISTS (SELECT 1 FROM public.match_game_states WHERE room_code = room.room_code) THEN
    RETURN jsonb_build_object('ok', true, 'ready', false, 'reason', 'match-already-initialized');
  END IF;
  SELECT deck INTO host_deck FROM public.match_deck_submissions
    WHERE room_code = room.room_code AND player_auth_uid = room.host_auth_uid;
  SELECT deck INTO guest_deck FROM public.match_deck_submissions
    WHERE room_code = room.room_code AND player_auth_uid = room.guest_auth_uid;
  IF host_deck IS NULL OR guest_deck IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'ready', false, 'reason', 'both-decks-required');
  END IF;
  RETURN jsonb_build_object('ok', true, 'ready', true, 'roomCode', room.room_code,
    'hostAuthUid', room.host_auth_uid, 'guestAuthUid', room.guest_auth_uid,
    'hostDeck', host_deck, 'guestDeck', guest_deck);
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_match_game_state(p_room_code text, p_initial_state jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE room public.match_rooms%ROWTYPE; host_deck jsonb; guest_deck jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Trusted match initializer required'; END IF;
  IF p_initial_state IS NULL OR jsonb_typeof(p_initial_state) <> 'object' OR pg_column_size(p_initial_state) > 1048576 THEN
    RAISE EXCEPTION 'Invalid initial match state';
  END IF;
  SELECT * INTO room FROM public.match_rooms WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF NOT FOUND OR room.host_auth_uid IS NULL OR room.guest_auth_uid IS NULL THEN RAISE EXCEPTION 'Room seats are not ready'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_game_states WHERE room_code = room.room_code) THEN RAISE EXCEPTION 'Canonical match state already exists'; END IF;
  SELECT deck INTO host_deck FROM public.match_deck_submissions
    WHERE room_code = room.room_code AND player_auth_uid = room.host_auth_uid FOR UPDATE;
  SELECT deck INTO guest_deck FROM public.match_deck_submissions
    WHERE room_code = room.room_code AND player_auth_uid = room.guest_auth_uid FOR UPDATE;
  IF host_deck IS NULL OR guest_deck IS NULL THEN RAISE EXCEPTION 'Both private deck submissions are required'; END IF;
  IF p_initial_state->'authoritySeats'->>'hostSide' IS DISTINCT FROM 'human' OR p_initial_state->'authoritySeats'->>'guestSide' IS DISTINCT FROM 'bot'
    OR NOT public.match_player_state_matches_deck(p_initial_state->'players'->'human', host_deck)
    OR NOT public.match_player_state_matches_deck(p_initial_state->'players'->'bot', guest_deck) THEN
    RAISE EXCEPTION 'Initial state does not match the seated deck submissions';
  END IF;
  UPDATE public.match_deck_submissions SET locked_for_match = true
    WHERE room_code = room.room_code AND player_auth_uid IN (room.host_auth_uid, room.guest_auth_uid);
  INSERT INTO public.match_game_states(room_code, state_version, state)
    VALUES (room.room_code, 0, p_initial_state);
  RETURN jsonb_build_object('roomCode', room.room_code, 'stateVersion', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_card_definitions(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_card_definitions(text[]) TO service_role;
REVOKE ALL ON FUNCTION public.claim_match_decks_for_initialization(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_match_decks_for_initialization(text) TO service_role;
REVOKE ALL ON FUNCTION public.initialize_match_game_state(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_match_game_state(text, jsonb) TO service_role;
