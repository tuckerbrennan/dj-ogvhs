-- DJ OGVHS: invite-only collaborative playlists.
-- Requires the existing dj_admins table (202611030001_requests.sql).
-- All access routes through the collab-room Edge Function using service_role.
-- Never grant anonymous PostgREST access to these tables or RPCs.

create table if not exists public.dj_collab_rooms (
  id uuid primary key default gen_random_uuid(),
  invite_hash text not null unique check (invite_hash ~ '^[a-f0-9]{64}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  is_open boolean not null default true,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists dj_collab_rooms_created_by_idx on public.dj_collab_rooms(created_by, created_at desc);

create table if not exists public.dj_collab_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.dj_collab_rooms(id) on delete cascade,
  kind text not null check (kind in ('catalog', 'manual', 'spotify_playlist')),
  title text not null default '' check (char_length(title) <= 150),
  artist text not null default '' check (char_length(artist) <= 120),
  catalog_id text check (catalog_id is null or char_length(catalog_id) <= 128),
  spotify_url text check (spotify_url is null or char_length(spotify_url) <= 120),
  contributor_name text not null default '' check (char_length(contributor_name) <= 80),
  client_key text not null check (client_key ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists dj_collab_entries_room_idx on public.dj_collab_entries(room_id, created_at);
create index if not exists dj_collab_entries_client_idx on public.dj_collab_entries(room_id, client_key, created_at);

alter table public.dj_collab_rooms enable row level security;
alter table public.dj_collab_entries enable row level security;
revoke all on public.dj_collab_rooms from public, anon, authenticated;
revoke all on public.dj_collab_entries from public, anon, authenticated;

-- Transactionally check invite, room status, duplicates and limits before insert.
-- Lock the ROOM, so parallel submissions cannot defeat its 500-entry cap.
create or replace function public.dj_submit_collab_entry(
  p_invite_hash text,
  p_client_key text,
  p_kind text,
  p_title text,
  p_artist text,
  p_catalog_id text,
  p_spotify_url text,
  p_contributor_name text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_room public.dj_collab_rooms%rowtype;
  v_id uuid;
  v_recent integer;
  v_total integer;
begin
  if p_invite_hash is null or p_invite_hash !~ '^[a-f0-9]{64}$'
    or p_client_key is null or p_client_key !~ '^[a-f0-9]{64}$' then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;
  select * into v_room from public.dj_collab_rooms
    where invite_hash = p_invite_hash for update;
  if not found then
    return pg_catalog.jsonb_build_object('status', 'not_found');
  end if;
  if not v_room.is_open or v_room.expires_at <= now() then
    return pg_catalog.jsonb_build_object('status', 'closed');
  end if;
  if p_kind not in ('catalog','manual','spotify_playlist')
    or char_length(coalesce(p_contributor_name,'')) > 80 then
    return pg_catalog.jsonb_build_object('status', 'invalid');
  end if;
  if p_kind = 'spotify_playlist' then
    if p_spotify_url is null
      or p_spotify_url !~ '^https://open[.]spotify[.]com/playlist/[A-Za-z0-9]{22}$' then
      return pg_catalog.jsonb_build_object('status', 'invalid');
    end if;
    if exists(select 1 from public.dj_collab_entries
              where room_id = v_room.id and kind = p_kind
              and spotify_url = p_spotify_url) then
      return pg_catalog.jsonb_build_object('status', 'duplicate');
    end if;
  else
    if char_length(pg_catalog.btrim(coalesce(p_title,''))) not between 1 and 150
      or char_length(coalesce(p_artist,'')) > 120
      or (p_kind = 'catalog' and char_length(pg_catalog.btrim(coalesce(p_catalog_id,''))) not between 1 and 128) then
      return pg_catalog.jsonb_build_object('status', 'invalid');
    end if;
    if p_kind = 'catalog' and exists(
      select 1 from public.dj_collab_entries
      where room_id = v_room.id and kind = 'catalog' and catalog_id = p_catalog_id
    ) then
      return pg_catalog.jsonb_build_object('status', 'duplicate');
    end if;
  end if;
  select count(*) into v_recent
    from public.dj_collab_entries where room_id = v_room.id
    and client_key = p_client_key
    and created_at >= now() - interval '60 minutes';
  if v_recent >= 12 then
    return pg_catalog.jsonb_build_object('status', 'limit');
  end if;
  select count(*) into v_total from public.dj_collab_entries
    where room_id = v_room.id;
  if v_total >= 500 then
    return pg_catalog.jsonb_build_object('status', 'full');
  end if;
  insert into public.dj_collab_entries
    (room_id, kind, title, artist, catalog_id, spotify_url, contributor_name, client_key)
    values (v_room.id, p_kind,
      case when p_kind = 'spotify_playlist' then 'Spotify playlist' else pg_catalog.btrim(p_title) end,
      case when p_kind = 'spotify_playlist' then '' else pg_catalog.btrim(coalesce(p_artist,'')) end,
      case when p_kind = 'catalog' then p_catalog_id else null end,
      case when p_kind = 'spotify_playlist' then p_spotify_url else null end,
      coalesce(pg_catalog.btrim(p_contributor_name), ''), p_client_key)
    returning id into v_id;
  return pg_catalog.jsonb_build_object('status','accepted','id',v_id);
end;
$$;
revoke all on function public.dj_submit_collab_entry(text,text,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.dj_submit_collab_entry(text,text,text,text,text,text,text,text)
  to service_role;
