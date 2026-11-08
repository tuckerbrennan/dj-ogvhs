-- DJ OGVHS Collab: private email invite requests and room-specific Drive uploads.
-- Requires 202611060002_collaborative_playlists.sql.
-- All data access is via service_role Edge Functions; no public table access.

alter table public.dj_collab_rooms
  add column if not exists drive_folder_id text
    check (drive_folder_id is null or drive_folder_id ~ '^[A-Za-z0-9_-]{10,200}$');

create table if not exists public.dj_collab_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  email_key text not null unique check (email_key ~ '^[a-f0-9]{64}$'),
  client_key text not null check (client_key ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists dj_collab_access_requests_created_idx
  on public.dj_collab_access_requests(created_at desc);
create index if not exists dj_collab_access_requests_client_idx
  on public.dj_collab_access_requests(client_key,created_at);

create table if not exists public.dj_collab_uploads (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.dj_collab_rooms(id) on delete cascade,
  client_key text not null check (client_key ~ '^[a-f0-9]{64}$'),
  filename text not null check (char_length(filename) between 1 and 160),
  mime_type text not null check (char_length(mime_type) between 1 and 100),
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  drive_file_id text unique check (drive_file_id is null or drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  status text not null default 'pending' check (status in ('pending','complete','failed')),
  created_at timestamptz not null default now()
);
create index if not exists dj_collab_uploads_room_idx on public.dj_collab_uploads(room_id,created_at desc);
create index if not exists dj_collab_uploads_client_idx on public.dj_collab_uploads(room_id,client_key,created_at);

alter table public.dj_collab_access_requests enable row level security;
alter table public.dj_collab_uploads enable row level security;
revoke all on public.dj_collab_access_requests from public, anon, authenticated;
revoke all on public.dj_collab_uploads from public, anon, authenticated;

-- Do not depend on project-wide default privileges for trusted server access.
grant select, update on public.dj_collab_access_requests to service_role;
grant select, update on public.dj_collab_uploads to service_role;

-- Anonymous interested visitors: do not disclose whether an address is already present.
-- Serialize requests per client_key; limit 3 new addresses per rolling 24 hours.
create or replace function public.dj_request_collab_access(
  p_email text, p_email_key text, p_client_key text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if p_email is null or char_length(p_email) not between 3 and 254
    or p_email_key is null or p_email_key !~ '^[a-f0-9]{64}$'
    or p_client_key is null or p_client_key !~ '^[a-f0-9]{64}$' then
    return pg_catalog.jsonb_build_object('status','invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_client_key)::bigint);
  select count(*) into v_count from public.dj_collab_access_requests
    where client_key = p_client_key and created_at > now() - interval '24 hours';
  if v_count >= 3 then
    return pg_catalog.jsonb_build_object('status','limit');
  end if;
  insert into public.dj_collab_access_requests(email,email_key,client_key)
    values (p_email,p_email_key,p_client_key)
    on conflict (email_key) do update set last_requested_at=now();
  return pg_catalog.jsonb_build_object('status','accepted');
end;
$$;
revoke all on function public.dj_request_collab_access(text,text,text)
  from public, anon, authenticated;
grant execute on function public.dj_request_collab_access(text,text,text) to service_role;

-- Guests can reserve only if they hold a valid room invitation.
-- Lock the room for concurrency-safe 100-file room and 5/hour/client limits.
create or replace function public.dj_reserve_collab_upload(
  p_invite_hash text, p_client_key text, p_filename text,
  p_mime_type text, p_size_bytes bigint
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_room public.dj_collab_rooms%rowtype;
  v_total integer;
  v_recent integer;
  v_id uuid;
begin
  if p_invite_hash is null or p_invite_hash !~ '^[a-f0-9]{64}$'
    or p_client_key is null or p_client_key !~ '^[a-f0-9]{64}$'
    or p_filename is null or char_length(p_filename) not between 1 and 160
    or p_mime_type is null or char_length(p_mime_type) not between 1 and 100
    or p_size_bytes is null or p_size_bytes not between 1 and 15728640 then
    return pg_catalog.jsonb_build_object('status','invalid');
  end if;
  select * into v_room from public.dj_collab_rooms
    where invite_hash = p_invite_hash for update;
  if not found then return pg_catalog.jsonb_build_object('status','not_found'); end if;
  if not v_room.is_open or v_room.expires_at <= now() then
    return pg_catalog.jsonb_build_object('status','closed');
  end if;
  if v_room.drive_folder_id is null then
    return pg_catalog.jsonb_build_object('status','not_configured');
  end if;
  select count(*) into v_total from public.dj_collab_uploads
    where room_id = v_room.id and status in ('pending','complete');
  if v_total >= 100 then
    return pg_catalog.jsonb_build_object('status','full');
  end if;
  select count(*) into v_recent from public.dj_collab_uploads
    where room_id=v_room.id and client_key=p_client_key
    and status in ('pending','complete')
    and created_at > now() - interval '60 minutes';
  if v_recent >= 5 then
    return pg_catalog.jsonb_build_object('status','limit');
  end if;
  insert into public.dj_collab_uploads(room_id,client_key,filename,mime_type,size_bytes)
    values(v_room.id,p_client_key,p_filename,p_mime_type,p_size_bytes)
    returning id into v_id;
  -- Folder IDs only returned to the trusted server-side Edge Function, NEVER to browser.
  return pg_catalog.jsonb_build_object(
    'status','reserved','id',v_id,'folderId',v_room.drive_folder_id);
end;
$$;
revoke all on function public.dj_reserve_collab_upload(text,text,text,text,bigint)
  from public,anon,authenticated;
grant execute on function public.dj_reserve_collab_upload(text,text,text,text,bigint)
  to service_role;
