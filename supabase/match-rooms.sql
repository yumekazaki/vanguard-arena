-- Run once in Supabase Dashboard > SQL Editor.
-- Public room metadata is discoverable; password hashes and peer IDs are never listed.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.match_rooms (
  room_code text primary key check (room_code ~ '^[A-Z0-9]{8}$'),
  peer_id text not null,
  room_name text not null check (char_length(room_name) between 1 and 32),
  host_name text not null check (char_length(host_name) between 1 and 24),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.match_rooms enable row level security;
revoke all on public.match_rooms from anon, authenticated;

create or replace function public.create_match_room(p_room_code text,p_peer_id text,p_room_name text,p_host_name text,p_password text)
returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  if length(p_password)<1 or length(p_password)>48 then raise exception 'Invalid room password'; end if;
  insert into public.match_rooms(room_code,peer_id,room_name,host_name,password_hash)
  values(upper(p_room_code),p_peer_id,left(coalesce(nullif(trim(p_room_name),''),'Vanguard room'),32),left(coalesce(nullif(trim(p_host_name),''),'Player'),24),extensions.crypt(p_password,extensions.gen_salt('bf')));
end $$;

create or replace function public.list_match_rooms()
returns table(room_code text,room_name text,host_name text) language sql security definer set search_path=public as $$
  select r.room_code,r.room_name,r.host_name from public.match_rooms r
  where r.updated_at > now()-interval '10 minutes' order by r.updated_at desc limit 50;
$$;

create or replace function public.resolve_match_room(p_room_code text,p_password text)
returns text language sql security definer set search_path=public,extensions as $$
  select r.peer_id from public.match_rooms r
  where r.room_code=upper(p_room_code) and r.updated_at>now()-interval '10 minutes'
    and extensions.crypt(coalesce(p_password,''),r.password_hash)=r.password_hash limit 1;
$$;

create or replace function public.touch_match_room(p_room_code text)
returns void language sql security definer set search_path=public as $$
  update public.match_rooms set updated_at=now() where room_code=upper(p_room_code);
$$;

create or replace function public.close_match_room(p_room_code text)
returns void language sql security definer set search_path=public as $$
  delete from public.match_rooms where room_code=upper(p_room_code);
$$;

grant execute on function public.create_match_room(text,text,text,text,text) to anon,authenticated;
grant execute on function public.list_match_rooms() to anon,authenticated;
grant execute on function public.resolve_match_room(text,text) to anon,authenticated;
grant execute on function public.touch_match_room(text) to anon,authenticated;
grant execute on function public.close_match_room(text) to anon,authenticated;
