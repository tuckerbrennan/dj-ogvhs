-- DJ OGVHS rolling request limit: 3 successfully saved requests per 60 minutes,
-- per anonymous browser identifier. Existing base migration must be applied first.
-- This intentionally avoids grouping everyone on venue Wi-Fi under one IP quota.

create table if not exists public.dj_request_quota (
  client_key text primary key check (client_key ~ '^[a-f0-9]{64}$'),
  accepted_at timestamptz[] not null default '{}'::timestamptz[],
  updated_at timestamptz not null default now()
);
alter table public.dj_request_quota enable row level security;
revoke all on public.dj_request_quota from public, anon, authenticated;

-- Only trusted Edge Functions may query the per-browser quota. No raw browser ID
-- is stored here; the function supplies an HMAC-SHA256 keyed digest.
create or replace function public.get_dj_request_quota(p_client_key text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_times timestamptz[] := '{}'::timestamptz[];
  v_count integer;
  v_now timestamptz := now();
  v_next timestamptz;
begin
  if p_client_key is null or p_client_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid listener identifier';
  end if;
  select coalesce(q.accepted_at, '{}'::timestamptz[])
    into v_times from public.dj_request_quota q where q.client_key = p_client_key;
  v_times := coalesce(v_times, '{}'::timestamptz[]);
  v_times := array(select t from unnest(v_times) t
                   where t > v_now - interval '60 minutes' and t <= v_now
                   order by t);
  v_count := cardinality(v_times);
  if v_count >= 3 then
    v_next := v_times[1] + interval '60 minutes';
  end if;
  return pg_catalog.jsonb_build_object(
    'limit', 3,
    'remaining', greatest(0, 3 - v_count),
    'nextAvailableAt', v_next,
    'retryAfterSeconds', case when v_next is null then 0 else greatest(1, ceil(extract(epoch from v_next - v_now))::integer) end
  );
end;
$$;
revoke all on function public.get_dj_request_quota(text) from public, anon, authenticated;
grant execute on function public.get_dj_request_quota(text) to service_role;

-- Returns an accepted flag and updated quota. Refused submissions are NEVER inserted.
-- A locked quota row makes the check-and-insert atomic across concurrent requests.
create or replace function public.submit_dj_request_v2(
  p_type text, p_songs jsonb, p_listener_name text, p_client_key text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_expected integer;
  v_song jsonb;
  v_now timestamptz;
  v_times timestamptz[] := '{}'::timestamptz[];
  v_count integer;
  v_next timestamptz;
  v_id uuid;
begin
  v_expected := case p_type when 'song' then 1 when 'mashup' then 2 else 0 end;
  if v_expected = 0 or p_songs is null or pg_catalog.jsonb_typeof(p_songs) <> 'array'
    or pg_catalog.jsonb_array_length(p_songs) <> v_expected then
    raise exception 'Invalid request type or number of songs';
  end if;
  if p_client_key is null or p_client_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid listener identifier';
  end if;
  if p_listener_name is not null and pg_catalog.char_length(p_listener_name) > 80 then
    raise exception 'Name too long';
  end if;
  for v_song in select value from pg_catalog.jsonb_array_elements(p_songs) loop
    if pg_catalog.jsonb_typeof(v_song) <> 'object'
      or coalesce(pg_catalog.jsonb_typeof(v_song->'title'), '') <> 'string'
      or pg_catalog.char_length(pg_catalog.btrim(coalesce(v_song->>'title', ''))) not between 1 and 150
      or coalesce(pg_catalog.char_length(v_song->>'artist'), 0) > 120
      or coalesce(v_song->>'source', '') not in ('catalog','external','manual') then
      raise exception 'Invalid song selection';
    end if;
    if v_song->>'source' = 'catalog'
      and coalesce(v_song->>'catalogId','') = '' then
      raise exception 'Missing catalog ID';
    end if;
  end loop;

  insert into public.dj_request_quota (client_key)
  values (p_client_key) on conflict (client_key) do nothing;

  select q.accepted_at into v_times
    from public.dj_request_quota q where q.client_key = p_client_key for update;
  v_now := pg_catalog.clock_timestamp();
  v_times := array(select t from unnest(v_times) t
                   where t > v_now - interval '60 minutes' and t <= v_now
                   order by t);
  v_count := cardinality(v_times);
  if v_count >= 3 then
    v_next := v_times[1] + interval '60 minutes';
    return pg_catalog.jsonb_build_object(
      'accepted', false, 'remaining', 0, 'limit', 3,
      'nextAvailableAt', v_next,
      'retryAfterSeconds', greatest(1, ceil(extract(epoch from v_next - v_now))::integer)
    );
  end if;

  insert into public.dj_requests (type, songs, listener_name)
    values (p_type, p_songs, nullif(pg_catalog.btrim(p_listener_name), ''))
    returning id into v_id;
  v_times := pg_catalog.array_append(v_times, v_now);
  update public.dj_request_quota
    set accepted_at = v_times, updated_at = v_now
    where client_key = p_client_key;

  return pg_catalog.jsonb_build_object(
    'accepted', true, 'id', v_id, 'remaining', 3 - cardinality(v_times), 'limit', 3,
    'nextAvailableAt', case when cardinality(v_times) = 3 then v_times[1] + interval '60 minutes' else null end,
    'retryAfterSeconds', case when cardinality(v_times) = 3 then greatest(1, ceil(extract(epoch from (v_times[1] + interval '60 minutes') - v_now))::integer) else 0 end
  );
end;
$$;
revoke all on function public.submit_dj_request_v2(text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.submit_dj_request_v2(text,jsonb,text,text) to service_role;
