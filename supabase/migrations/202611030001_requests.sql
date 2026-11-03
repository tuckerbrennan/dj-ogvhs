-- DJ OGVHS request storage. Apply in a private Supabase project, never in the public repo.
create table if not exists public.dj_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.dj_admins enable row level security;
revoke all on public.dj_admins from public, anon, authenticated;
grant select on public.dj_admins to authenticated;
create policy "admins can view own membership" on public.dj_admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_dj_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.dj_admins where user_id = (select auth.uid())) $$;
revoke all on function public.is_dj_admin() from public, anon;
grant execute on function public.is_dj_admin() to authenticated;

create sequence if not exists public.dj_request_sort_seq;
revoke all on sequence public.dj_request_sort_seq from public, anon, authenticated;

create table if not exists public.dj_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('song', 'mashup')),
  songs jsonb not null check (jsonb_typeof(songs) = 'array'),
  listener_name text check (char_length(listener_name) <= 80),
  status text not null default 'pending' check (status in ('pending','later','played','skipped')),
  bpm numeric(6,2) check (bpm is null or (bpm > 0 and bpm < 350)),
  sort_order bigint not null default nextval('public.dj_request_sort_seq'::regclass),
  created_at timestamptz not null default now()
);
create index if not exists dj_requests_created_at_idx on public.dj_requests (created_at desc);
alter table public.dj_requests enable row level security;
revoke all on public.dj_requests from public, anon, authenticated;
grant select on public.dj_requests to authenticated;
grant update (status, bpm, sort_order) on public.dj_requests to authenticated;
create policy "admin read requests" on public.dj_requests
  for select to authenticated using ((select public.is_dj_admin()));
create policy "admin edit requests" on public.dj_requests
  for update to authenticated using ((select public.is_dj_admin()))
  with check ((select public.is_dj_admin()));

create table if not exists public.dj_request_rate_limits (
  client_key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.dj_request_rate_limits enable row level security;
revoke all on public.dj_request_rate_limits from public, anon, authenticated;

-- Only the trusted Edge Function (service_role) can call this function.
create or replace function public.submit_dj_request(
  p_type text, p_songs jsonb, p_listener_name text, p_client_key text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_expected integer;
  v_song jsonb;
  v_attempts integer;
  v_id uuid;
  v_now timestamptz := now();
begin
  v_expected := case p_type when 'song' then 1 when 'mashup' then 2 else 0 end;
  if v_expected = 0 or p_songs is null or jsonb_typeof(p_songs) <> 'array'
     or jsonb_array_length(p_songs) <> v_expected then
    raise exception 'Invalid request type or number of songs';
  end if;
  if p_client_key is null or length(p_client_key) <> 64
     or p_client_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate limit key';
  end if;
  if p_listener_name is not null and char_length(p_listener_name) > 80 then
    raise exception 'Name too long';
  end if;
  for v_song in select value from jsonb_array_elements(p_songs) loop
    if jsonb_typeof(v_song) <> 'object'
       or coalesce(jsonb_typeof(v_song->'title'),'') <> 'string'
       or char_length(btrim(coalesce(v_song->>'title',''))) not between 1 and 150
       or coalesce(char_length(v_song->>'artist'), 0) > 120
       or coalesce(v_song->>'source','') not in ('catalog','external','manual') then
      raise exception 'Invalid song selection';
    end if;
    if v_song->>'source' = 'catalog' and coalesce(v_song->>'catalogId','') = '' then
      raise exception 'Missing catalog ID';
    end if;
  end loop;

  insert into public.dj_request_rate_limits (client_key,window_start,attempts)
  values (p_client_key,v_now,1)
  on conflict (client_key) do update
  set attempts = case
    when dj_request_rate_limits.window_start < v_now - interval '10 minutes' then 1
    else dj_request_rate_limits.attempts + 1 end,
  window_start = case
    when dj_request_rate_limits.window_start < v_now - interval '10 minutes' then v_now
    else dj_request_rate_limits.window_start end
  returning attempts into v_attempts;
  if v_attempts > 5 then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.dj_requests (type, songs, listener_name)
  values (p_type, p_songs, nullif(btrim(p_listener_name), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_dj_request(text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.submit_dj_request(text,jsonb,text,text) to service_role;
 
-- Swap two requests atomically; check DJ membership using the caller's JWT.
create or replace function public.swap_dj_request_order(p_first uuid, p_second uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_first bigint;
  v_second bigint;
begin
  if not public.is_dj_admin() then
    raise exception 'DJ admin access required' using errcode = '42501';
  end if;
  if p_first = p_second or p_first is null or p_second is null then
    raise exception 'Choose two different requests';
  end if;
  -- Serialise concurrent reorders by acquiring a transaction-scoped advisory lock.
  perform pg_catalog.pg_advisory_xact_lock(865102617, 1);
  select sort_order into strict v_first from public.dj_requests where id = p_first for update;
  select sort_order into strict v_second from public.dj_requests where id = p_second for update;
  update public.dj_requests set sort_order =
    case when id = p_first then v_second else v_first end
  where id in (p_first,p_second);
end;
$$;
revoke all on function public.swap_dj_request_order(uuid,uuid) from public, anon;
grant execute on function public.swap_dj_request_order(uuid,uuid) to authenticated;
