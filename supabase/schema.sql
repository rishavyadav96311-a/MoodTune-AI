-- Run this in Supabase Dashboard -> SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  mood text not null default 'Calm',
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_track_id text not null,
  title text not null,
  artist text not null,
  audio_url text not null,
  image_url text,
  provider text not null default 'Jamendo',
  license_url text,
  created_at timestamptz not null default now(),
  unique (playlist_id, provider_track_id)
);

create table if not exists public.liked_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_track_id text not null,
  title text not null,
  artist text not null,
  audio_url text not null,
  image_url text,
  provider text not null default 'Jamendo',
  license_url text,
  created_at timestamptz not null default now(),
  unique (user_id, provider_track_id)
);

alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.liked_tracks enable row level security;

create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users create own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own playlists" on public.playlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own playlist tracks" on public.playlist_tracks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own liked tracks" on public.liked_tracks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
