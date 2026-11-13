-- Private Bloud workspaces and verified-identity RLS.
-- Forward-only: legacy demo rows (owner_id/user_id = 'me'/'partner') are
-- deliberately left untouched and remain inaccessible to authenticated users.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Listener',
  joined_at timestamptz not null default now(),
  constraint workspace_members_display_name_length check (char_length(display_name) between 1 and 80)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);

alter table public.playlists
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.rooms
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade,
  add column if not exists host_user_id uuid references auth.users (id) on delete set null;

alter table public.room_playback
  add column if not exists queue_track_ids text[] not null default '{}',
  add column if not exists queue_adder_ids text[] not null default '{}',
  add column if not exists updated_by_device_id text not null default '';

create index if not exists idx_playlists_owner_user on public.playlists (owner_user_id);
create index if not exists idx_playlists_workspace on public.playlists (workspace_id) where workspace_id is not null;
create index if not exists idx_workspace_members_workspace on public.workspace_members (workspace_id, joined_at);
create index if not exists idx_workspace_invites_workspace on public.workspace_invites (workspace_id, expires_at);
create index if not exists idx_rooms_workspace on public.rooms (workspace_id) where workspace_id is not null;

-- A workspace is intentionally limited to two authenticated accounts. Sharing
-- policies use is_paired_workspace_member, which requires exactly two members
-- including auth.uid(); these helpers run as owner to avoid recursive RLS.
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select p_workspace_id is not null and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_paired_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select p_workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = p_workspace_id
        and wm.user_id = (select auth.uid())
    )
    and (
      select pg_catalog.count(*) = 2
      from public.workspace_members wm
      where wm.workspace_id = p_workspace_id
    );
$$;

create or replace function public.is_room_workspace_member(p_room_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.rooms r
    where r.code = p_room_code
      and r.workspace_id is not null
      and r.status <> 'closed'
      and public.is_paired_workspace_member(r.workspace_id)
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function public.is_paired_workspace_member(uuid) from public, anon, authenticated;
revoke all on function public.is_room_workspace_member(text) from public, anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_paired_workspace_member(uuid) to authenticated;
grant execute on function public.is_room_workspace_member(text) to authenticated;

create or replace function public.get_my_workspace()
returns table (workspace_id uuid, user_id uuid, display_name text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select wm.workspace_id, wm.user_id, wm.display_name, wm.joined_at
  from public.workspace_members wm
  where wm.workspace_id = (
    select mine.workspace_id
    from public.workspace_members mine
    where mine.user_id = (select auth.uid())
    limit 1
  )
  order by wm.joined_at, wm.user_id;
$$;

create or replace function public.create_workspace_invite()
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_token text;
  v_member_count integer;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Sign in to create a workspace invite.' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = v_user_id;

  if v_workspace_id is null then
    insert into public.workspaces (created_by)
    values (v_user_id)
    returning id into v_workspace_id;

    v_display_name := coalesce(nullif(pg_catalog.btrim(pg_catalog.left(coalesce(
      nullif(pg_catalog.btrim(auth.jwt() -> 'user_metadata' ->> 'display_name'), ''),
      nullif(pg_catalog.split_part(auth.jwt() ->> 'email', '@', 1), ''),
      'Listener'
    ), 80)), ''), 'Listener');

    insert into public.workspace_members (workspace_id, user_id, display_name)
    values (v_workspace_id, v_user_id, v_display_name);
  end if;

  perform 1 from public.workspaces w where w.id = v_workspace_id for update;
  select pg_catalog.count(*)::integer into v_member_count
  from public.workspace_members wm
  where wm.workspace_id = v_workspace_id;

  if v_member_count >= 2 then
    raise exception 'This workspace already has two members.' using errcode = '23514';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.workspace_invites (workspace_id, token_hash, invited_by, expires_at)
  values (
    v_workspace_id,
    pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_user_id,
    pg_catalog.now() + interval '7 days'
  );

  return v_token;
end;
$$;

create or replace function public.accept_workspace_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_current_workspace uuid;
  v_invited_by uuid;
  v_accepted_by uuid;
  v_accepted_at timestamptz;
  v_expires_at timestamptz;
  v_member_count integer;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Sign in to accept a workspace invite.' using errcode = '28000';
  end if;
  if p_invite_code is null or p_invite_code !~ '^[a-f0-9]{64}$' then
    raise exception 'This workspace invite is invalid or has expired.' using errcode = '22023';
  end if;

  select wi.workspace_id, wi.invited_by, wi.accepted_by, wi.accepted_at, wi.expires_at
  into v_workspace_id, v_invited_by, v_accepted_by, v_accepted_at, v_expires_at
  from public.workspace_invites wi
  where wi.token_hash = pg_catalog.encode(extensions.digest(p_invite_code, 'sha256'), 'hex')
  for update;

  if v_workspace_id is null then
    raise exception 'This workspace invite is invalid or has expired.' using errcode = '22023';
  end if;
  if v_accepted_at is not null then
    if v_accepted_by = v_user_id then
      return v_workspace_id;
    end if;
    raise exception 'This workspace invite is invalid or has expired.' using errcode = '22023';
  end if;
  if v_expires_at <= pg_catalog.now() then
    raise exception 'This workspace invite is invalid or has expired.' using errcode = '22023';
  end if;
  if v_invited_by = v_user_id then
    raise exception 'You cannot accept your own workspace invite.' using errcode = '22023';
  end if;

  -- Serialise accepts for a workspace so two simultaneous invitees cannot take
  -- the final seat or push it beyond the two-person limit.
  perform 1 from public.workspaces w where w.id = v_workspace_id for update;

  select wm.workspace_id into v_current_workspace
  from public.workspace_members wm
  where wm.user_id = v_user_id;

  if v_current_workspace = v_workspace_id then
    raise exception 'Your account is already a member of this workspace.' using errcode = '23505';
  elsif v_current_workspace is not null then
    raise exception 'Your account already belongs to another workspace.' using errcode = '23505';
  end if;

  select pg_catalog.count(*)::integer into v_member_count
  from public.workspace_members wm
  where wm.workspace_id = v_workspace_id;
  if v_member_count >= 2 then
    raise exception 'This workspace already has two members.' using errcode = '23514';
  end if;

  v_display_name := coalesce(nullif(pg_catalog.btrim(pg_catalog.left(coalesce(
    nullif(pg_catalog.btrim(auth.jwt() -> 'user_metadata' ->> 'display_name'), ''),
    nullif(pg_catalog.split_part(auth.jwt() ->> 'email', '@', 1), ''),
    'Listener'
  ), 80)), ''), 'Listener');
  insert into public.workspace_members (workspace_id, user_id, display_name)
  values (v_workspace_id, v_user_id, v_display_name);

  update public.workspace_invites
  set accepted_by = v_user_id, accepted_at = pg_catalog.now()
  where token_hash = pg_catalog.encode(extensions.digest(p_invite_code, 'sha256'), 'hex');

  return v_workspace_id;
end;
$$;

create or replace function public.create_room(p_device_id text)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_member_count integer;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Sign in to start a room.' using errcode = '28000';
  end if;
  if p_device_id is null or pg_catalog.length(p_device_id) < 1 or pg_catalog.length(p_device_id) > 128 then
    raise exception 'Invalid device identifier.' using errcode = '22023';
  end if;

  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id = v_user_id;
  if v_workspace_id is null then
    raise exception 'Create a two-person workspace before starting a room.' using errcode = '42501';
  end if;
  select pg_catalog.count(*)::integer into v_member_count
  from public.workspace_members wm
  where wm.workspace_id = v_workspace_id;
  if v_member_count <> 2 then
    raise exception 'Your workspace needs two members before starting a room.' using errcode = '42501';
  end if;

  loop
    v_code := 'TNDM-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.rooms r where r.code = v_code);
  end loop;

  insert into public.rooms (code, status, host_id, host_user_id, workspace_id)
  values (v_code, 'waiting', v_user_id::text, v_user_id, v_workspace_id);

  insert into public.room_members (room_code, user_id, device_id, online, last_seen)
  values (v_code, v_user_id::text, p_device_id, true, pg_catalog.now());

  insert into public.room_playback (room_code, updated_by, updated_by_device_id)
  values (v_code, v_user_id::text, p_device_id);

  return v_code;
end;
$$;

create or replace function public.join_room(p_code text, p_device_id text)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_member_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to join a room.' using errcode = '28000';
  end if;
  if p_code is null or p_code !~ '^TNDM-[A-F0-9]{8}$'
     or p_device_id is null or pg_catalog.length(p_device_id) < 1 or pg_catalog.length(p_device_id) > 128 then
    raise exception 'Invalid room code.' using errcode = '22023';
  end if;

  select r.workspace_id into v_workspace_id
  from public.rooms r
  where r.code = p_code and r.status <> 'closed';
  if v_workspace_id is null or not public.is_workspace_member(v_workspace_id) then
    raise exception 'We could not find a room you are allowed to join.' using errcode = '42501';
  end if;
  select pg_catalog.count(*)::integer into v_member_count
  from public.workspace_members wm
  where wm.workspace_id = v_workspace_id;
  if v_member_count <> 2 then
    raise exception 'Your workspace needs two members before joining a room.' using errcode = '42501';
  end if;

  insert into public.room_members (room_code, user_id, device_id, online, last_seen)
  values (p_code, v_user_id::text, p_device_id, true, pg_catalog.now())
  on conflict (room_code, user_id, device_id)
  do update set online = true, last_seen = pg_catalog.now();

  return p_code;
end;
$$;

create or replace function public.heartbeat_room(p_code text, p_device_id text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to update room presence.' using errcode = '28000';
  end if;
  if p_code is null or p_code !~ '^TNDM-[A-F0-9]{8}$'
     or p_device_id is null or pg_catalog.length(p_device_id) < 1 or pg_catalog.length(p_device_id) > 128 then
    raise exception 'Invalid room presence.' using errcode = '22023';
  end if;

  update public.room_members rm
  set online = true, last_seen = pg_catalog.now()
  from public.rooms r
  where rm.room_code = p_code
    and rm.user_id = v_user_id::text
    and rm.device_id = p_device_id
    and r.code = rm.room_code
    and r.status <> 'closed'
    and public.is_paired_workspace_member(r.workspace_id);
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'You are not a member of an open room.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.leave_room(p_code text, p_device_id text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to leave a room.' using errcode = '28000';
  end if;
  if p_device_id is null or pg_catalog.length(p_device_id) > 128 then
    raise exception 'Invalid device identifier.' using errcode = '22023';
  end if;

  delete from public.room_members rm
  where rm.room_code = p_code
    and rm.user_id = v_user_id::text
    and rm.device_id = p_device_id;
end;
$$;

create or replace function public.set_room_playback_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid()::text;
  end if;
  return new;
end;
$$;

create or replace function public.validate_room_playback()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_index integer;
begin
  if new.position_sec < 0 or new.position_sec >= 'Infinity'::double precision then
    raise exception 'Playback position must be a finite nonnegative number.' using errcode = '22023';
  end if;
  if new.track_id is not null and pg_catalog.length(new.track_id) > 256 then
    raise exception 'Playback track identifiers are limited to 256 characters.' using errcode = '22023';
  end if;
  if pg_catalog.length(coalesce(new.updated_by_device_id, '')) > 128 then
    raise exception 'Device identifiers are limited to 128 characters.' using errcode = '22023';
  end if;
  if pg_catalog.array_ndims(new.queue_track_ids) > 1 or pg_catalog.array_ndims(new.queue_adder_ids) > 1 then
    raise exception 'Playback queues must be one-dimensional.' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.cardinality(new.queue_track_ids), 0) > 200
     or coalesce(pg_catalog.cardinality(new.queue_adder_ids), 0) > 200 then
    raise exception 'Playback queues are limited to 200 tracks.' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.cardinality(new.queue_track_ids), 0)
     <> coalesce(pg_catalog.cardinality(new.queue_adder_ids), 0) then
    raise exception 'Queue adder identities must match the queue length.' using errcode = '22023';
  end if;

  for v_index in 1..coalesce(pg_catalog.array_length(new.queue_track_ids, 1), 0) loop
    if new.queue_track_ids[v_index] is null or pg_catalog.length(new.queue_track_ids[v_index]) > 256 then
      raise exception 'Queue track identifiers are limited to 256 characters.' using errcode = '22023';
    end if;
    if new.queue_adder_ids[v_index] is not null and pg_catalog.length(new.queue_adder_ids[v_index]) > 128 then
      raise exception 'Queue adder identifiers are limited to 128 characters.' using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.set_room_event_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid()::text;
  end if;
  return new;
end;
$$;

create or replace function public.set_playlist_item_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.added_by := auth.uid()::text;
    else
      -- Reordering an existing item must not rewrite who originally added it.
      new.added_by := old.added_by;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_room_playback_identity on public.room_playback;
create trigger trg_room_playback_identity
  before insert or update on public.room_playback
  for each row execute function public.set_room_playback_identity();

drop trigger if exists trg_room_playback_validate on public.room_playback;
create trigger trg_room_playback_validate
  before insert or update on public.room_playback
  for each row execute function public.validate_room_playback();

drop trigger if exists trg_room_event_identity on public.room_events;
create trigger trg_room_event_identity
  before insert on public.room_events
  for each row execute function public.set_room_event_identity();

drop trigger if exists trg_playlist_item_identity on public.playlist_items;
create trigger trg_playlist_item_identity
  before insert or update on public.playlist_items
  for each row execute function public.set_playlist_item_identity();

revoke all on function public.get_my_workspace() from public, anon, authenticated;
revoke all on function public.create_workspace_invite() from public, anon, authenticated;
revoke all on function public.accept_workspace_invite(text) from public, anon, authenticated;
revoke all on function public.create_room(text) from public, anon, authenticated;
revoke all on function public.join_room(text, text) from public, anon, authenticated;
revoke all on function public.heartbeat_room(text, text) from public, anon, authenticated;
revoke all on function public.leave_room(text, text) from public, anon, authenticated;
revoke all on function public.set_room_playback_identity() from public, anon, authenticated;
revoke all on function public.validate_room_playback() from public, anon, authenticated;
revoke all on function public.set_room_event_identity() from public, anon, authenticated;
revoke all on function public.set_playlist_item_identity() from public, anon, authenticated;
grant execute on function public.get_my_workspace() to authenticated;
grant execute on function public.create_workspace_invite() to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.heartbeat_room(text, text) to authenticated;
grant execute on function public.leave_room(text, text) to authenticated;

-- Supersede the permissive demo policies from 001 without modifying legacy data.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users','artists','albums','tracks','videos','categories','lyrics_sets',
    'playlists','playlist_items','liked_tracks','saved_albums','followed_artists',
    'recent_searches','play_history','continue_listening',
    'rooms','room_members','room_playback','room_events'
  ] loop
    execute pg_catalog.format('drop policy if exists demo_all on public.%I', t);
  end loop;
end;
$$;

-- Reassert RLS across the full historical schema; never depend on the old
-- demo migration having left a particular table's RLS flag enabled.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_users','artists','albums','tracks','videos','categories','lyrics_sets',
    'playlists','playlist_items','liked_tracks','saved_albums','followed_artists',
    'recent_searches','play_history','continue_listening',
    'rooms','room_members','room_playback','room_events'
  ] loop
    execute pg_catalog.format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

-- Personal library tables: the row key must equal the verified JWT subject.
do $$
declare
  t text;
begin
  foreach t in array array[
    'liked_tracks','saved_albums','followed_artists','recent_searches',
    'play_history','continue_listening'
  ] loop
    execute pg_catalog.format('alter table public.%I enable row level security', t);
    execute pg_catalog.format(
      'create policy %I on public.%I for all to authenticated using (user_id = ((select auth.uid())::text)) with check (user_id = ((select auth.uid())::text))',
      t || '_self_only', t
    );
  end loop;
end;
$$;

-- Catalogue content is shared and read-only to authenticated accounts.
do $$
declare
  t text;
begin
  foreach t in array array['artists','albums','tracks','videos','categories','lyrics_sets'] loop
    execute pg_catalog.format('alter table public.%I enable row level security', t);
    execute pg_catalog.format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_authenticated_read', t
    );
  end loop;
end;
$$;

-- No client policy is created for app_users: legacy demo profiles are not
-- account identities. Workspace member profiles are returned by the RPC above.

create policy workspaces_member_read on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

create policy workspace_members_visible_to_pair on public.workspace_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_workspace_member(workspace_id));

-- workspace_invites intentionally has no direct authenticated policies; only
-- its security-definer RPCs can create/accept invites, and only hashes persist.

create policy playlists_read_owned_or_shared on public.playlists
  for select to authenticated
  using (
    kind = 'mix'
    or owner_user_id = (select auth.uid())
    or (collaborative and workspace_id is not null and public.is_paired_workspace_member(workspace_id))
  );

create policy playlists_insert_owned on public.playlists
  for insert to authenticated
  with check (
    kind = 'user'
    and owner_user_id = (select auth.uid())
    and (
      (not collaborative and workspace_id is null)
      or (collaborative and workspace_id is not null and public.is_paired_workspace_member(workspace_id))
    )
  );

create policy playlists_update_owned on public.playlists
  for update to authenticated
  using (kind = 'user' and owner_user_id = (select auth.uid()))
  with check (
    kind = 'user'
    and owner_user_id = (select auth.uid())
    and (
      (not collaborative and workspace_id is null)
      or (collaborative and workspace_id is not null and public.is_paired_workspace_member(workspace_id))
    )
  );

create policy playlists_delete_owned on public.playlists
  for delete to authenticated
  using (kind = 'user' and owner_user_id = (select auth.uid()));

create policy playlist_items_read_accessible on public.playlist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and (
          p.kind = 'mix'
          or p.owner_user_id = (select auth.uid())
          or (p.collaborative and p.workspace_id is not null and public.is_paired_workspace_member(p.workspace_id))
        )
    )
  );

create policy playlist_items_insert_owner_or_collaborator on public.playlist_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and p.kind = 'user'
        and (
          p.owner_user_id = (select auth.uid())
          or (p.collaborative and p.workspace_id is not null and public.is_paired_workspace_member(p.workspace_id))
        )
    )
  );

create policy playlist_items_update_owner_or_collaborator on public.playlist_items
  for update to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and p.kind = 'user'
        and (
          p.owner_user_id = (select auth.uid())
          or (p.collaborative and p.workspace_id is not null and public.is_paired_workspace_member(p.workspace_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and p.kind = 'user'
        and (
          p.owner_user_id = (select auth.uid())
          or (p.collaborative and p.workspace_id is not null and public.is_paired_workspace_member(p.workspace_id))
        )
    )
  );

create policy playlist_items_delete_owner_or_collaborator on public.playlist_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and p.kind = 'user'
        and (
          p.owner_user_id = (select auth.uid())
          or (p.collaborative and p.workspace_id is not null and public.is_paired_workspace_member(p.workspace_id))
        )
    )
  );

create policy rooms_workspace_read on public.rooms
  for select to authenticated
  using (status <> 'closed' and workspace_id is not null and public.is_paired_workspace_member(workspace_id));

create policy room_members_workspace_read on public.room_members
  for select to authenticated
  using (public.is_room_workspace_member(room_code));

-- Presence writes go through heartbeat_room so callers cannot move their
-- membership row into another room or spoof a client-chosen last_seen time.
drop policy if exists room_members_self_update on public.room_members;

-- Membership rows are created, heartbeated, and removed only by Auth-bound RPCs.
drop policy if exists room_members_self_delete on public.room_members;

create policy room_playback_workspace_read on public.room_playback
  for select to authenticated
  using (public.is_room_workspace_member(room_code));

create policy room_playback_workspace_insert on public.room_playback
  for insert to authenticated
  with check (public.is_room_workspace_member(room_code));

create policy room_playback_workspace_update on public.room_playback
  for update to authenticated
  using (public.is_room_workspace_member(room_code))
  with check (public.is_room_workspace_member(room_code));

create policy room_events_workspace_read on public.room_events
  for select to authenticated
  using (public.is_room_workspace_member(room_code));

-- Private Realtime topics: presence and broadcast only work for authenticated
-- members of the room's two-person workspace.
alter table realtime.messages enable row level security;
drop policy if exists bloud_room_messages_read on realtime.messages;
drop policy if exists bloud_room_messages_send on realtime.messages;
create policy bloud_room_messages_read on realtime.messages
  for select to authenticated
  using (
    pg_catalog.split_part(realtime.topic(), ':', 1) = 'room'
    and public.is_room_workspace_member(pg_catalog.split_part(realtime.topic(), ':', 2))
  );
create policy bloud_room_messages_send on realtime.messages
  for insert to authenticated
  with check (
    pg_catalog.split_part(realtime.topic(), ':', 1) = 'room'
    and public.is_room_workspace_member(pg_catalog.split_part(realtime.topic(), ':', 2))
  );

-- Keep the tables used by the current Realtime bridge in the publication.
do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.room_playback;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.room_events;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.playlists;
exception when duplicate_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.playlist_items;
exception when duplicate_object then null;
end;
$$;
