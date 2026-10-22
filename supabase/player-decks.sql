-- Run once in Supabase Dashboard > SQL Editor for this Vanguard Arena project.
create table if not exists public.player_decks (
  user_id uuid not null references auth.users (id) on delete cascade,
  deck_id text not null,
  name text not null default 'Untitled deck' check (char_length(name) <= 40),
  cards jsonb not null default '{}'::jsonb check (jsonb_typeof(cards) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

alter table public.player_decks enable row level security;
revoke all on table public.player_decks from anon, authenticated;
grant select, insert, update, delete on table public.player_decks to authenticated;

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
