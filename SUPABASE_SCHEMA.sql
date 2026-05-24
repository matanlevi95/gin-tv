-- Run this once in Supabase SQL editor for the gin-tv project to enable
-- email/password auth + cloud-synced player profiles.
--
-- This is OPTIONAL. The app works in guest mode without these tables.

-- Profiles table — one row per authenticated user.
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null default 'אורח',
  avatar_letter   text not null default 'א',
  total_wins      int  not null default 0,
  win_streak      int  not null default 0,
  games_played    int  not null default 0,
  first_win       bool not null default false,
  first_gin       bool not null default false,
  three_streak    bool not null default false,
  knock_win       bool not null default false,
  undercut        bool not null default false,
  ach_10          bool not null default false,
  ach_50          bool not null default false,
  saved_tvs       jsonb not null default '[]',
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select using ( auth.uid() = id );

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert with check ( auth.uid() = id );

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using ( auth.uid() = id );

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_letter)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'אורח'),
    substr(coalesce(new.raw_user_meta_data->>'display_name', 'א'), 1, 1)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Match history (per player)
create table if not exists public.match_history (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references auth.users(id) on delete cascade,
  game_type    text not null,
  opponent     text not null,
  won          bool not null,
  final_score  int  not null,
  played_at    timestamptz not null default now()
);

alter table public.match_history enable row level security;

drop policy if exists "users read own history" on public.match_history;
create policy "users read own history" on public.match_history
  for select using ( auth.uid() = player_id );

drop policy if exists "users insert own history" on public.match_history;
create policy "users insert own history" on public.match_history
  for insert with check ( auth.uid() = player_id );

create index if not exists match_history_player_at_idx
  on public.match_history (player_id, played_at desc);
