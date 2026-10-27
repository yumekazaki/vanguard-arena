-- Lease queued commands to one trusted worker at a time.
-- Run after match-authority-v1.sql. Browser roles cannot invoke these RPCs.

ALTER TABLE public.match_action_commands
  ADD COLUMN IF NOT EXISTS worker_claim_token uuid,
  ADD COLUMN IF NOT EXISTS worker_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_lease_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_match_action(p_room_code text, p_lease_seconds integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  canonical public.match_game_states%ROWTYPE;
  command public.match_action_commands%ROWTYPE;
  lease_token uuid;
  lease_seconds integer := greatest(5, least(coalesce(p_lease_seconds, 30), 120));
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Trusted match worker required'; END IF;
  SELECT * INTO canonical FROM public.match_game_states
    WHERE room_code = upper(p_room_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Canonical match state is not initialized'; END IF;
  IF canonical.pending_action_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'claimed', false); END IF;

  SELECT * INTO command FROM public.match_action_commands
    WHERE room_code = canonical.room_code AND action_id = canonical.pending_action_id FOR UPDATE;
  IF NOT FOUND OR command.status <> 'queued' OR command.expected_state_version <> canonical.state_version THEN
    RAISE EXCEPTION 'Pending command does not match canonical state';
  END IF;
  IF command.worker_claim_token IS NOT NULL
    AND command.worker_lease_expires_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'claimed', false, 'reason', 'command-leased');
  END IF;

  lease_token := gen_random_uuid();
  UPDATE public.match_action_commands SET worker_claim_token = lease_token, worker_claimed_at = now(),
    worker_lease_expires_at = now() + make_interval(secs => lease_seconds)
    WHERE room_code = canonical.room_code AND action_id = command.action_id;
  RETURN jsonb_build_object(
    'ok', true, 'claimed', true, 'roomCode', canonical.room_code,
    'actionId', command.action_id, 'actorAuthUid', command.actor_auth_uid,
    'expectedStateVersion', command.expected_state_version, 'payload', command.payload,
    'state', canonical.state, 'leaseToken', lease_token,
    'hostAuthUid', (SELECT host_auth_uid FROM public.match_rooms WHERE room_code = canonical.room_code),
    'guestAuthUid', (SELECT guest_auth_uid FROM public.match_rooms WHERE room_code = canonical.room_code)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.complete_match_action(text, text, boolean, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.complete_match_action(
  p_room_code text,
  p_action_id text,
  p_claim_token uuid,
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
  IF NOT FOUND OR command.status <> 'queued' OR command.expected_state_version <> canonical.state_version
    OR command.worker_claim_token IS DISTINCT FROM p_claim_token
    OR command.worker_lease_expires_at IS NULL OR command.worker_lease_expires_at <= now() THEN
    RAISE EXCEPTION 'Command lease is invalid or expired';
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

REVOKE ALL ON FUNCTION public.claim_match_action(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_match_action(text, text, uuid, boolean, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_match_action(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_match_action(text, text, uuid, boolean, jsonb, jsonb) TO service_role;
