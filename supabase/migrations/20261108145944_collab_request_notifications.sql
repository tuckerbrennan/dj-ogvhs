-- Private delivery bookkeeping; existing RLS and service-only grants remain in force.
alter table public.dj_collab_access_requests
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_claimed_at timestamptz;
