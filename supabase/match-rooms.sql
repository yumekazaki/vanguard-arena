-- Base room directory for Supabase Realtime matches.
-- Run this before match-auth-v1.sql.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.match_rooms (
  room_code text PRIMARY KEY CHECK (room_code ~ '^[A-F0-9]{16}$'),
  peer_id text NOT NULL UNIQUE,
  room_name text NOT NULL,
  host_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.match_rooms FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_match_room(
  p_room_code text,
  p_peer_id text,
  p_room_name text,
  p_host_name text,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_room_code IS NULL OR upper(p_room_code) !~ '^[A-F0-9]{16}$' THEN
    RAISE EXCEPTION 'Invalid room code';
  END IF;
  IF p_peer_id IS NULL OR length(p_peer_id) < 1 OR length(p_peer_id) > 256 THEN
    RAISE EXCEPTION 'Invalid room connection ID';
  END IF;
  IF p_password IS NULL OR length(p_password) < 1 OR length(p_password) > 128 THEN
    RAISE EXCEPTION 'A room password is required';
  END IF;

  INSERT INTO public.match_rooms(room_code, peer_id, room_name, host_name, password_hash)
  VALUES (
    upper(p_room_code), p_peer_id,
    left(coalesce(nullif(trim(p_room_name), ''), 'Vanguard room'), 80),
    left(coalesce(nullif(trim(p_host_name), ''), 'Player'), 24),
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_match_rooms()
RETURNS TABLE(room_code text, room_name text, host_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT room.room_code, room.room_name, room.host_name
    FROM public.match_rooms AS room
   WHERE room.updated_at > now() - interval '10 minutes'
   ORDER BY room.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.resolve_match_room(p_room_code text, p_password text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT room.peer_id
    FROM public.match_rooms AS room
   WHERE room.room_code = upper(coalesce(p_room_code, ''))
     AND room.updated_at > now() - interval '10 minutes'
     AND extensions.crypt(coalesce(p_password, ''), room.password_hash) = room.password_hash
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.create_match_room(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_match_rooms() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_match_room(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match_room(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_match_rooms() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_match_room(text, text) TO anon, authenticated;
