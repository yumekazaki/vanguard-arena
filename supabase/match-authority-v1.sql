-- Canonical online match state and an authenticated, versioned command boundary.
-- Run after match-rooms.sql and match-auth-v1.sql.
-- The trusted match worker must validate and reduce queued commands before calling
-- complete_match_action. Browser clients never write canonical state directly.

CREATE TABLE IF NOT EXISTS public.match_game_states (
  room_code text PRIMARY KEY REFERENCES public.match_rooms(room_code) ON DELETE CASCADE,
  state_version bigint NOT NULL DEFAULT 0 CHECK (state_version >= 0),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  pending_action_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_action_commands (
  room_code text NOT NULL REFERENCES public.match_rooms(room_code) ON DELETE CASCADE,
  action_id text NOT NULL CHECK (length(action_id) BETWEEN 1 AND 180),
  actor_auth_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_state_version bigint NOT NULL CHECK (expected_state_version >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 32768),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'accepted', 'rejected')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (room_code, action_id)
);

ALTER TABLE public.match_game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_action_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_game_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.match_action_commands FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.match_game_states TO service_role;
GRANT ALL ON TABLE public.match_action_commands TO service_role;

CREATE OR REPLACE FUNCTION public.initialize_match_game_state(p_room_code text, p_initial_state jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE room public.match_rooms%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Trusted match worker required'; END IF;
  IF p_initial_state IS NULL OR jsonb_typeof(p_initial_state) <> 'object' OR pg_column_size(p_initial_state) > 1048576 THEN
    RAISE EXCEPTION 'Invalid initial match state';
  END IF;
  SELECT * INTO room FROM public.match_rooms WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF NOT FOUND OR room.host_auth_uid IS NULL OR room.guest_auth_uid IS NULL THEN RAISE EXCEPTION 'Room seats are not ready'; END IF;
  INSERT INTO public.match_game_states(room_code, state_version, state)
    VALUES (room.room_code, 0, p_initial_state)
    ON CONFLICT (room_code) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'Canonical match state already exists'; END IF;
  RETURN jsonb_build_object('roomCode', room.room_code, 'stateVersion', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_match_action(
  p_room_code text,
  p_action_id text,
  p_expected_state_version bigint,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  room public.match_rooms%ROWTYPE;
  canonical public.match_game_states%ROWTYPE;
  existing public.match_action_commands%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Signed-in match identity required'; END IF;
  IF p_action_id IS NULL OR length(p_action_id) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Invalid action ID'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 32768 THEN RAISE EXCEPTION 'Invalid action payload'; END IF;
  SELECT * INTO room FROM public.match_rooms WHERE room_code = upper(p_room_code) FOR SHARE;
  IF NOT FOUND OR (auth.uid() IS DISTINCT FROM room.host_auth_uid AND auth.uid() IS DISTINCT FROM room.guest_auth_uid) THEN RAISE EXCEPTION 'Player is not seated in this room'; END IF;
  IF p_payload ?| ARRAY['actorPlayerId', 'actorAuthUid', 'matchId', 'expectedStateVersion', 'actionId'] THEN
    RAISE EXCEPTION 'Identity and version fields belong in the authenticated command envelope';
  END IF;

  SELECT * INTO existing FROM public.match_action_commands
    WHERE room_code = room.room_code AND action_id = p_action_id;
  IF FOUND THEN
    IF existing.actor_auth_uid <> auth.uid() THEN RAISE EXCEPTION 'Action ID belongs to another player'; END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', existing.status,
      'stateVersion', existing.expected_state_version, 'result', existing.result);
  END IF;

  SELECT * INTO canonical FROM public.match_game_states WHERE room_code = room.room_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Canonical match state is not initialized'; END IF;
  IF canonical.pending_action_id IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'command-in-progress'); END IF;
  IF canonical.state_version <> p_expected_state_version THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale-state-version', 'stateVersion', canonical.state_version);
  END IF;

  INSERT INTO public.match_action_commands(room_code, action_id, actor_auth_uid, expected_state_version, payload)
    VALUES (room.room_code, p_action_id, auth.uid(), p_expected_state_version, p_payload);
  UPDATE public.match_game_states SET pending_action_id = p_action_id, updated_at = now()
    WHERE room_code = room.room_code;
  RETURN jsonb_build_object('ok', true, 'queued', true, 'actionId', p_action_id,
    'stateVersion', canonical.state_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_match_action(
  p_room_code text,
  p_action_id text,
  p_accepted boolean,
  p_next_state jsonb,
  p_result jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE canonical public.match_game_states%ROWTYPE; command public.match_action_commands%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Trusted match worker required'; END IF;
  SELECT * INTO canonical FROM public.match_game_states
    WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF NOT FOUND OR canonical.pending_action_id IS DISTINCT FROM p_action_id THEN RAISE EXCEPTION 'Action is not the active command'; END IF;
  SELECT * INTO command FROM public.match_action_commands
    WHERE room_code = canonical.room_code AND action_id = p_action_id FOR UPDATE;
  IF NOT FOUND OR command.status <> 'queued' OR command.expected_state_version <> canonical.state_version THEN
    RAISE EXCEPTION 'Queued command does not match the canonical state';
  END IF;
  IF p_accepted AND (p_next_state IS NULL OR jsonb_typeof(p_next_state) <> 'object' OR pg_column_size(p_next_state) > 1048576) THEN
    RAISE EXCEPTION 'Accepted action requires a valid next state';
  END IF;
  IF p_accepted THEN
    UPDATE public.match_game_states SET state = p_next_state, state_version = state_version + 1,
      pending_action_id = NULL, updated_at = now() WHERE room_code = canonical.room_code;
  ELSE
    UPDATE public.match_game_states SET pending_action_id = NULL, updated_at = now()
      WHERE room_code = canonical.room_code;
  END IF;
  UPDATE public.match_action_commands SET status = CASE WHEN p_accepted THEN 'accepted' ELSE 'rejected' END,
    result = coalesce(p_result, '{}'::jsonb), processed_at = now()
    WHERE room_code = canonical.room_code AND action_id = p_action_id;
  RETURN jsonb_build_object('ok', true, 'accepted', p_accepted,
    'stateVersion', canonical.state_version + CASE WHEN p_accepted THEN 1 ELSE 0 END,
    'result', coalesce(p_result, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_match_game_state(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_match_action(text, text, boolean, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_match_action(text, text, bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_match_game_state(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_match_action(text, text, boolean, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_match_action(text, text, bigint, jsonb) TO authenticated;
