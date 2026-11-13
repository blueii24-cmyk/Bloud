-- ============================================================================
-- Bloud (Tandem) — Supabase schema
-- Mirrors src/types.ts 1:1 so the frontend maps rows -> domain types directly.
--
-- Tables:
--   app_users          demo identities ("me" / "partner") + future auth link
--   artists / albums / tracks / videos / categories / lyrics_sets  catalogue
--   playlists / playlist_items                                     mixes + user lists
--   liked_tracks / saved_albums / followed_artists                 per-user library
--   recent_searches / play_history / continue_listening            per-user state
--   rooms / room_members / room_playback / room_events             Listen Together
--
-- Historical baseline: the original demo used permissive policies for anon
-- and authenticated roles. Cloud deployments must apply the forward-only
-- private-workspace migration (20261112030000_private_workspace_security.sql)
-- immediately after this schema; do not use this baseline alone in production.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users (demo identities; `auth_user_id` links to auth.users once Auth ships)
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id            text primary key,               -- 'me' | 'partner' | uuid
  display_name  text not null,
  initials      text not null,
  color_a       text not null,
  color_b       text not null,
  auth_user_id  uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.artists (
  id                text primary key,
  name              text not null,
  genre             text not null default '',
  bio               text not null default '',
  monthly_listeners bigint not null default 0,
  art               jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists public.albums (
  id         text primary key,
  title      text not null,
  artist_id  text not null references public.artists (id) on delete cascade,
  year       integer not null default 2025,
  genre      text not null default '',
  art        jsonb not null default '{}'::jsonb,
  added_at   date not null default current_date,
  track_ids  text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.tracks (
  id         text primary key,
  title      text not null,
  artist_id  text not null references public.artists (id) on delete cascade,
  album_id   text not null references public.albums (id) on delete cascade,
  duration   integer not null default 0,        -- seconds
  genre      text not null default '',
  art        jsonb not null default '{}'::jsonb,
  added_at   date not null default current_date,
  lyric_set  integer,
  explicit   boolean not null default false,
  audio_url  text,                              -- future: Drive / Storage URL
  position   integer not null default 0,        -- track number within album
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id         text primary key,
  title      text not null,
  artist_id  text not null references public.artists (id) on delete cascade,
  track_id   text not null references public.tracks (id) on delete cascade,
  duration   integer not null default 0,
  year       integer not null default 2025,
  views      text not null default '0',
  art        jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id         text primary key,
  name       text not null,
  query      text not null default '',
  color      text not null default '#333333',
  pattern    text not null default 'rings',
  created_at timestamptz not null default now()
);

create table if not exists public.lyrics_sets (
  id         integer primary key,
  lines      text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Playlists (user lists + curated mixes share one table, like the frontend)
-- ---------------------------------------------------------------------------
create table if not exists public.playlists (
  id            text primary key,
  name          text not null,
  description   text not null default '',
  owner_id      text not null default 'me',     -- 'me' | 'partner' | 'tandem'
  collaborative boolean not null default false,
  kind          text not null default 'user',   -- 'user' | 'mix'
  art           jsonb not null default '{}'::jsonb,
  created_at    bigint not null default 0,      -- epoch ms (matches frontend)
  updated_at    bigint not null default 0
);

create table if not exists public.playlist_items (
  playlist_id text not null references public.playlists (id) on delete cascade,
  track_id    text not null references public.tracks (id) on delete cascade,
  added_by    text not null default 'me',
  added_at    bigint not null default 0,
  position    integer not null default 0,
  primary key (playlist_id, track_id)
);

-- ---------------------------------------------------------------------------
-- Per-user library
-- ---------------------------------------------------------------------------
create table if not exists public.liked_tracks (
  user_id    text not null default 'me',
  track_id   text not null references public.tracks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.saved_albums (
  user_id    text not null default 'me',
  album_id   text not null references public.albums (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

create table if not exists public.followed_artists (
  user_id    text not null default 'me',
  artist_id  text not null references public.artists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table if not exists public.recent_searches (
  user_id     text not null default 'me',
  query       text not null,
  searched_at timestamptz not null default now(),
  primary key (user_id, query)
);

create table if not exists public.play_history (
  user_id    text not null default 'me',
  track_id   text not null references public.tracks (id) on delete cascade,
  played_at  timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.continue_listening (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default 'me',
  type       text not null,                     -- 'track' | 'album'
  item_id    text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Listen Together rooms (Supabase Realtime: presence + postgres changes
-- + broadcast for instant playback events)
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  code       text primary key,                  -- e.g. 'TNDM-4821'
  status     text not null default 'waiting',   -- 'waiting' | 'live' | 'closed'
  host_id    text not null default 'me',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_code  text not null references public.rooms (code) on delete cascade,
  user_id    text not null default 'me',
  device_id  text not null default '',
  online     boolean not null default true,
  last_seen  timestamptz not null default now(),
  primary key (room_code, user_id, device_id)
);

create table if not exists public.room_playback (
  room_code    text primary key references public.rooms (code) on delete cascade,
  track_id     text,
  position_sec double precision not null default 0,
  is_playing   boolean not null default false,
  updated_by   text not null default 'me',
  updated_at   timestamptz not null default now()
);

create table if not exists public.room_events (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null references public.rooms (code) on delete cascade,
  type       text not null,                     -- 'play'|'pause'|'seek'|'track'|'queue'
  payload    jsonb not null default '{}'::jsonb,
  created_by text not null default 'me',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_tracks_album on public.tracks (album_id, position);
create index if not exists idx_tracks_artist on public.tracks (artist_id);
create index if not exists idx_albums_artist on public.albums (artist_id);
create index if not exists idx_playlist_items_playlist on public.playlist_items (playlist_id, position);
create index if not exists idx_liked_user on public.liked_tracks (user_id);
create index if not exists idx_history_user on public.play_history (user_id, played_at desc);
create index if not exists idx_searches_user on public.recent_searches (user_id, searched_at desc);
create index if not exists idx_room_events_room on public.room_events (room_code, created_at desc);
create index if not exists idx_room_members_room on public.room_members (room_code);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_rooms_updated on public.rooms;
create trigger trg_rooms_updated
  before update on public.rooms
  for each row execute function public.set_updated_at();

drop trigger if exists trg_room_playback_updated on public.room_playback;
create trigger trg_room_playback_updated
  before update on public.room_playback
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Secure defaults: RLS is on and no client role receives broad demo access.
-- The forward private-workspace migration adds only Auth-bound policies.
-- ---------------------------------------------------------------------------
alter table public.app_users enable row level security;
alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.videos enable row level security;
alter table public.categories enable row level security;
alter table public.lyrics_sets enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.liked_tracks enable row level security;
alter table public.saved_albums enable row level security;
alter table public.followed_artists enable row level security;
alter table public.recent_searches enable row level security;
alter table public.play_history enable row level security;
alter table public.continue_listening enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_playback enable row level security;
alter table public.room_events enable row level security;

-- ---------------------------------------------------------------------------
-- Realtime: publish tables the frontend subscribes to
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_playback;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.playlists;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.playlist_items;
exception when duplicate_object then null;
end $$;
