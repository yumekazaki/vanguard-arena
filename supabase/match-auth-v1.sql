-- Run after match-rooms.sql. Requires Supabase Anonymous Sign-ins to be enabled.
-- Binds game-player relay directions to one authenticated room host and one joiner.
ALTER TABLE public.match_rooms
  ADD COLUMN IF NOT EXISTS host_auth_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_auth_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.bind_match_room_host_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'A signed-in match session is required'; END IF;
  NEW.host_auth_uid := auth.uid();
  NEW.guest_auth_uid := NULL;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS match_room_host_identity ON public.match_rooms;
CREATE TRIGGER match_room_host_identity
  BEFORE INSERT ON public.match_rooms
  FOR EACH ROW EXECUTE FUNCTION public.bind_match_room_host_identity();

CREATE OR REPLACE FUNCTION public.claim_player_match_room(p_room_code text, p_password text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE claimed_peer_id text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'A signed-in match session is required'; END IF;
  UPDATE public.match_rooms AS room
    SET guest_auth_uid = auth.uid(), updated_at = now()
    WHERE room.room_code = upper(p_room_code)
      AND room.updated_at > now() - interval '10 minutes'
      AND extensions.crypt(coalesce(p_password, ''), room.password_hash) = room.password_hash
      AND room.host_auth_uid IS DISTINCT FROM auth.uid()
      AND (room.guest_auth_uid IS NULL OR room.guest_auth_uid = auth.uid())
    RETURNING room.peer_id INTO claimed_peer_id;
  RETURN claimed_peer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_match_room(p_room_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.match_rooms SET updated_at = now()
   WHERE room_code = upper(p_room_code) AND host_auth_uid = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.close_match_room(p_room_code text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.match_rooms
   WHERE room_code = upper(p_room_code) AND host_auth_uid = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.create_match_room(text,text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_match_room(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_player_match_room(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_match_room(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_match_room(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.touch_match_room(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_match_room(text) FROM anon;

CREATE OR REPLACE FUNCTION public.can_read_match_relay(p_topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_rooms room
     WHERE auth.uid() IN (room.host_auth_uid, room.guest_auth_uid)
       AND p_topic IN (
         'vanguard-room:' || room.room_code || ':guest-host',
         'vanguard-room:' || room.room_code || ':host-guest'
       )
  );
$$;
CREATE OR REPLACE FUNCTION public.can_send_match_relay(p_topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_rooms room
     WHERE (auth.uid() = room.guest_auth_uid
            AND p_topic = 'vanguard-room:' || room.room_code || ':guest-host')
        OR (auth.uid() = room.host_auth_uid
            AND p_topic = 'vanguard-room:' || room.room_code || ':host-guest')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_match_relay(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_send_match_relay(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_match_relay(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_match_relay(text) TO authenticated;

-- Guest may send only on guest->host. Host may send only on host->guest.
-- Both players can subscribe to both channels so they can send and receive.
DROP POLICY IF EXISTS vanguard_room_players_read_relay ON realtime.messages;
CREATE POLICY vanguard_room_players_read_relay
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND public.can_read_match_relay(realtime.topic())
  );

DROP POLICY IF EXISTS vanguard_room_player_directional_relay ON realtime.messages;
CREATE POLICY vanguard_room_player_directional_relay
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'broadcast'
    AND public.can_send_match_relay(realtime.topic())
  );
