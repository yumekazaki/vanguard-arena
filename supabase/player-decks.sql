-- Run once in Supabase Dashboard > SQL Editor for this Vanguard Arena project.
create table if not exists public.player_decks (
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id text not null,
  name text not null default 'Untitled deck' check (char_length(name) <= 40),
  cards jsonb not null default '{}'::jsonb check (jsonb_typeof(cards) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 32),
  bio text not null default '' check (char_length(bio) <= 160),
  updated_at timestamptz not null default now()
);

alter table public.player_decks enable row level security;
alter table public.player_profiles enable row level security;
revoke all on table public.player_decks from anon, authenticated;
grant select, insert, update, delete on table public.player_decks to authenticated;
revoke all on table public.player_profiles from anon, authenticated;
grant select on table public.player_profiles to anon, authenticated;
grant insert, update on table public.player_profiles to authenticated;

drop policy if exists "Players read their own decks" on public.player_decks;
create policy "Players read their own decks"
  on public.player_decks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players insert their own decks" on public.player_decks;
create policy "Players insert their own decks"
  on public.player_decks for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players update their own decks" on public.player_decks;
create policy "Players update their own decks"
  on public.player_decks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players delete their own decks" on public.player_decks;
create policy "Players delete their own decks"
  on public.player_decks for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Profiles are public to read" on public.player_profiles;
create policy "Profiles are public to read"
  on public.player_profiles for select to anon, authenticated using (true);

drop policy if exists "Players create their own profile" on public.player_profiles;
create policy "Players create their own profile"
  on public.player_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players update their own profile" on public.player_profiles;
create policy "Players update their own profile"
  on public.player_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
