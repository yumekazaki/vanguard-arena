-- Private, per-seat deck registration for trusted match initialization.
-- Run after match-authority-v1.sql and match-authority-v2.sql.

CREATE TABLE IF NOT EXISTS public.match_deck_submissions (
  room_code text NOT NULL REFERENCES public.match_rooms(room_code) ON DELETE CASCADE,
  player_auth_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck jsonb NOT NULL CHECK (jsonb_typeof(deck) = 'object' AND pg_column_size(deck) <= 32768),
  locked_for_match boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, player_auth_uid)
);

ALTER TABLE public.match_deck_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_deck_submissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.match_deck_submissions TO service_role;

CREATE OR REPLACE FUNCTION public.submit_match_deck(p_room_code text, p_deck jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  room public.match_rooms%ROWTYPE;
  card_entry record;
  entry_count integer := 0;
  ready boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Signed-in match identity required'; END IF;
  IF p_deck IS NULL OR jsonb_typeof(p_deck) <> 'object' OR pg_column_size(p_deck) > 32768 THEN RAISE EXCEPTION 'Invalid deck submission'; END IF;
  IF jsonb_typeof(p_deck->'cards') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Deck cards must be an object'; END IF;
  IF jsonb_typeof(p_deck->'name') IS DISTINCT FROM 'string' OR length(p_deck->>'name') NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Invalid deck name'; END IF;
  IF jsonb_typeof(p_deck->'starterCardId') IS DISTINCT FROM 'string' OR length(p_deck->>'starterCardId') NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'Invalid starter card ID'; END IF;

  FOR card_entry IN SELECT key, value FROM jsonb_each(p_deck->'cards') LOOP
    entry_count := entry_count + 1;
    IF entry_count > 300 OR card_entry.key !~ '^[A-Za-z0-9_.:-]{1,128}$'
      OR jsonb_typeof(card_entry.value) <> 'number'
      OR (card_entry.value #>> '{}') !~ '^[0-4]$' THEN
      RAISE EXCEPTION 'Invalid card ID or quantity in deck submission';
    END IF;
  END LOOP;
  IF coalesce((p_deck->'cards'->>(p_deck->>'starterCardId'))::integer, 0) < 1 THEN RAISE EXCEPTION 'Starter must be in the submitted deck'; END IF;

  SELECT * INTO room FROM public.match_rooms WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS DISTINCT FROM room.host_auth_uid AND auth.uid() IS DISTINCT FROM room.guest_auth_uid THEN
    RAISE EXCEPTION 'Player is not seated in this room';
  END IF;
  IF room.guest_auth_uid IS NULL THEN RAISE EXCEPTION 'Waiting for the joining player'; END IF;
  IF EXISTS (SELECT 1 FROM public.match_game_states WHERE room_code = room.room_code) THEN RAISE EXCEPTION 'Match initialization already started'; END IF;

  INSERT INTO public.match_deck_submissions(room_code, player_auth_uid, deck)
    VALUES (room.room_code, auth.uid(), p_deck)
    ON CONFLICT (room_code, player_auth_uid) DO UPDATE
      SET deck = EXCLUDED.deck, submitted_at = now()
      WHERE public.match_deck_submissions.locked_for_match = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deck submissions are locked for initialization'; END IF;

  SELECT count(*) = 2 INTO ready FROM public.match_deck_submissions
    WHERE room_code = room.room_code AND player_auth_uid IN (room.host_auth_uid, room.guest_auth_uid);
  RETURN jsonb_build_object('ok', true, 'submitted', true, 'ready', ready);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_match_decks_for_initialization(p_room_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  room public.match_rooms%ROWTYPE;
  host_deck jsonb;
  guest_deck jsonb;
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
    WHERE room_code = room.room_code AND player_auth_uid = room.host_auth_uid FOR UPDATE;
  SELECT deck INTO guest_deck FROM public.match_deck_submissions
    WHERE room_code = room.room_code AND player_auth_uid = room.guest_auth_uid FOR UPDATE;
  IF host_deck IS NULL OR guest_deck IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'ready', false, 'reason', 'both-decks-required');
  END IF;
  UPDATE public.match_deck_submissions SET locked_for_match = true
    WHERE room_code = room.room_code AND player_auth_uid IN (room.host_auth_uid, room.guest_auth_uid);
  RETURN jsonb_build_object('ok', true, 'ready', true, 'roomCode', room.room_code,
    'hostAuthUid', room.host_auth_uid, 'guestAuthUid', room.guest_auth_uid,
    'hostDeck', host_deck, 'guestDeck', guest_deck);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_match_deck(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_match_deck(text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_match_decks_for_initialization(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_match_decks_for_initialization(text) TO service_role;
