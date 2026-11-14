-- VICE TENDER: run this script in your Supabase SQL Editor.
-- Everyone can read approved nominations and submit pending nominations.
-- Only the cast_vote function can add votes. Admins approve submissions in Supabase.

create extension if not exists pgcrypto;

create table if not exists public.currency_nominations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  ticker text not null check (ticker ~ '^[A-Z0-9._-]{1,15}$'),
  type text not null check (type in ('crypto', 'memecoin', 'fiat')),
  chain text check (char_length(chain) <= 35),
  contract_address text check (char_length(contract_address) <= 160),
  pitch text not null check (char_length(btrim(pitch)) between 12 and 280),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  votes_count integer not null default 0 check (votes_count >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists unique_currency_nomination
  on public.currency_nominations (lower(name), lower(ticker));
create index if not exists nominations_public_leaderboard
  on public.currency_nominations (votes_count desc, created_at desc)
  where status = 'approved';

create table if not exists public.currency_votes (
  id uuid primary key default gen_random_uuid(),
  currency_id uuid not null references public.currency_nominations(id) on delete cascade,
  voter_key uuid not null,
  created_at timestamptz not null default now(),
  unique (currency_id, voter_key)
);


-- Private contact information: never grant client-facing read access.
create table if not exists public.currency_submission_contacts (
  nomination_id uuid primary key references public.currency_nominations(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+
alter table public.currency_votes enable row level security;

drop policy if exists 'Read approved nominations' on public.currency_nominations;
create policy 'Read approved nominations' on public.currency_nominations
  for select to anon, authenticated using (status = 'approved');

-- Submissions now go through submit_nomination() so email and proposal insert atomically.
drop policy if exists 'Submit pending nominations' on public.currency_nominations;

revoke all on public.currency_nominations from anon, authenticated;
revoke all on public.currency_votes from anon, authenticated;
grant select (id, name, ticker, type, chain, pitch, votes_count, created_at)
  on public.currency_nominations to anon, authenticated;
-- NEVER grant SELECT on currency_submission_contacts to anonymous users.


-- Submit a proposal and its private notification email in one transaction.
create or replace function public.submit_nomination(
  p_name text, p_ticker text, p_type text, p_chain text,
  p_contract_address text, p_pitch text, p_email text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $
declare v_id uuid;
begin
  if p_email is null or char_length(btrim(p_email)) not between 3 and 254
     or btrim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+
-- Duplicate UUID votes for the same currency are rejected atomically.
create or replace function public.cast_vote(p_currency_id uuid, p_voter_key uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_rows integer;
begin
  if not exists (
    select 1 from public.currency_nominations
    where id = p_currency_id and status = 'approved'
  ) then
    raise exception 'Currency not eligible for voting';
  end if;
  insert into public.currency_votes (currency_id, voter_key)
  values (p_currency_id, p_voter_key)
  on conflict (currency_id, voter_key) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then return false; end if;
  update public.currency_nominations
  set votes_count = votes_count + 1
  where id = p_currency_id;
  return true;
end;
$$;
revoke all on function public.cast_vote(uuid, uuid) from public;
grant execute on function public.cast_vote(uuid, uuid) to anon, authenticated;

-- OPTIONAL: seed GTA Coin and UNITY Coin proposals in a new Supabase project.
-- Existing previously approved proposals must be reviewed separately.
/*
insert into public.currency_nominations (name, ticker, type, chain, pitch, status)
values
  ('GTA Coin', 'GTA', 'crypto', 'UNITY RP-inspired economy',
   'A proposed in-server currency for roleplay jobs, businesses, shopping, and trading.', 'approved'),
  ('UNITY Coin', 'UNITY', 'crypto', 'UNITY RP-inspired economy',
   'A proposed currency for roleplay jobs, player-owned shops, and trading.', 'approved')
on conflict do nothing;
*/
),
  approval_email_claimed_at timestamptz,
  approval_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.currency_submission_contacts enable row level security;
revoke all on public.currency_submission_contacts from public, anon, authenticated;

alter table public.currency_nominations enable row level security;
alter table public.currency_votes enable row level security;

drop policy if exists 'Read approved nominations' on public.currency_nominations;
create policy 'Read approved nominations' on public.currency_nominations
  for select to anon, authenticated using (status = 'approved');

drop policy if exists 'Submit pending nominations' on public.currency_nominations;
create policy 'Submit pending nominations' on public.currency_nominations
  for insert to anon, authenticated with check (status = 'pending' and votes_count = 0);

revoke all on public.currency_nominations from anon, authenticated;
revoke all on public.currency_votes from anon, authenticated;
grant select on public.currency_nominations to anon, authenticated;
grant insert (name, ticker, type, chain, contract_address, pitch)
  on public.currency_nominations to anon, authenticated;

-- Anonymous browser voters use a random persistent browser UUID.
-- Duplicate UUID votes for the same currency are rejected atomically.
create or replace function public.cast_vote(p_currency_id uuid, p_voter_key uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_rows integer;
begin
  if not exists (
    select 1 from public.currency_nominations
    where id = p_currency_id and status = 'approved'
  ) then
    raise exception 'Currency not eligible for voting';
  end if;
  insert into public.currency_votes (currency_id, voter_key)
  values (p_currency_id, p_voter_key)
  on conflict (currency_id, voter_key) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then return false; end if;
  update public.currency_nominations
  set votes_count = votes_count + 1
  where id = p_currency_id;
  return true;
end;
$$;
revoke all on function public.cast_vote(uuid, uuid) from public;
grant execute on function public.cast_vote(uuid, uuid) to anon, authenticated;

-- OPTIONAL: seed one GTA Coin proposal in a newly configured Supabase project.
-- Existing previously approved proposals must be reviewed separately.
/*
insert into public.currency_nominations (name, ticker, type, chain, pitch, status)
values ('GTA Coin', 'GTA', 'crypto', 'Vice City Roleplay',
'A proposed in-server currency for roleplay jobs, businesses, shopping, and trading.', 'approved')
on conflict do nothing;
*/

  then
    raise exception 'A valid notification email is required' using errcode = '22023';
  end if;
  insert into public.currency_nominations
    (name, ticker, type, chain, contract_address, pitch, status, votes_count)
  values (btrim(p_name), upper(btrim(p_ticker)), p_type,
    nullif(btrim(p_chain), ''), nullif(btrim(p_contract_address), ''),
    btrim(p_pitch), 'pending', 0)
  returning id into v_id;

  insert into public.currency_submission_contacts (nomination_id, email)
  values (v_id, lower(btrim(p_email)));

  return v_id;
end;
$;
revoke all on function public.submit_nomination(text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_nomination(text,text,text,text,text,text,text) to anon, authenticated;

-- Approval email jobs can only be claimed/completed by a backend service role.
-- A 10-minute lease prevents duplicate concurrent emails.
create or replace function public.claim_approval_notification(p_nomination_id uuid)
returns table(recipient_email text, currency_name text, currency_ticker text)
language plpgsql security definer set search_path = public, pg_temp
as $
begin
  return query
  with claimed as (
    update public.currency_submission_contacts c
       set approval_email_claimed_at = now()
     where c.nomination_id = p_nomination_id
       and c.approval_email_sent_at is null
       and (c.approval_email_claimed_at is null
            or c.approval_email_claimed_at < now() - interval '10 minutes')
       and exists (select 1 from public.currency_nominations n
                   where n.id = c.nomination_id and n.status = 'approved')
    returning c.email, c.nomination_id
  )
  select claimed.email, n.name, n.ticker
    from claimed join public.currency_nominations n on n.id = claimed.nomination_id;
end;
$;
revoke all on function public.claim_approval_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_approval_notification(uuid) to service_role;

create or replace function public.complete_approval_notification(p_nomination_id uuid)
returns void language sql security definer set search_path = public, pg_temp
as $
  update public.currency_submission_contacts
     set approval_email_sent_at = now()
   where nomination_id = p_nomination_id and approval_email_sent_at is null;
$;
revoke all on function public.complete_approval_notification(uuid) from public, anon, authenticated;
grant execute on function public.complete_approval_notification(uuid) to service_role;

create or replace function public.release_approval_notification(p_nomination_id uuid)
returns void language sql security definer set search_path = public, pg_temp
as $
  update public.currency_submission_contacts
     set approval_email_claimed_at = null
   where nomination_id = p_nomination_id and approval_email_sent_at is null;
$;
revoke all on function public.release_approval_notification(uuid) from public, anon, authenticated;
grant execute on function public.release_approval_notification(uuid) to service_role;

-- Anonymous browser voters use a random persistent browser UUID.
-- Duplicate UUID votes for the same currency are rejected atomically.
create or replace function public.cast_vote(p_currency_id uuid, p_voter_key uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_rows integer;
begin
  if not exists (
    select 1 from public.currency_nominations
    where id = p_currency_id and status = 'approved'
  ) then
    raise exception 'Currency not eligible for voting';
  end if;
  insert into public.currency_votes (currency_id, voter_key)
  values (p_currency_id, p_voter_key)
  on conflict (currency_id, voter_key) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then return false; end if;
  update public.currency_nominations
  set votes_count = votes_count + 1
  where id = p_currency_id;
  return true;
end;
$$;
revoke all on function public.cast_vote(uuid, uuid) from public;
grant execute on function public.cast_vote(uuid, uuid) to anon, authenticated;

-- OPTIONAL: seed one GTA Coin proposal in a newly configured Supabase project.
-- Existing previously approved proposals must be reviewed separately.
/*
insert into public.currency_nominations (name, ticker, type, chain, pitch, status)
values ('GTA Coin', 'GTA', 'crypto', 'Vice City Roleplay',
'A proposed in-server currency for roleplay jobs, businesses, shopping, and trading.', 'approved')
on conflict do nothing;
*/
),
  approval_email_claimed_at timestamptz,
  approval_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.currency_submission_contacts enable row level security;
revoke all on public.currency_submission_contacts from public, anon, authenticated;

alter table public.currency_nominations enable row level security;
alter table public.currency_votes enable row level security;

drop policy if exists 'Read approved nominations' on public.currency_nominations;
create policy 'Read approved nominations' on public.currency_nominations
  for select to anon, authenticated using (status = 'approved');

drop policy if exists 'Submit pending nominations' on public.currency_nominations;
create policy 'Submit pending nominations' on public.currency_nominations
  for insert to anon, authenticated with check (status = 'pending' and votes_count = 0);

revoke all on public.currency_nominations from anon, authenticated;
revoke all on public.currency_votes from anon, authenticated;
grant select on public.currency_nominations to anon, authenticated;
grant insert (name, ticker, type, chain, contract_address, pitch)
  on public.currency_nominations to anon, authenticated;

-- Anonymous browser voters use a random persistent browser UUID.
-- Duplicate UUID votes for the same currency are rejected atomically.
create or replace function public.cast_vote(p_currency_id uuid, p_voter_key uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_rows integer;
begin
  if not exists (
    select 1 from public.currency_nominations
    where id = p_currency_id and status = 'approved'
  ) then
    raise exception 'Currency not eligible for voting';
  end if;
  insert into public.currency_votes (currency_id, voter_key)
  values (p_currency_id, p_voter_key)
  on conflict (currency_id, voter_key) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then return false; end if;
  update public.currency_nominations
  set votes_count = votes_count + 1
  where id = p_currency_id;
  return true;
end;
$$;
revoke all on function public.cast_vote(uuid, uuid) from public;
grant execute on function public.cast_vote(uuid, uuid) to anon, authenticated;

-- OPTIONAL: seed one GTA Coin proposal in a newly configured Supabase project.
-- Existing previously approved proposals must be reviewed separately.
/*
insert into public.currency_nominations (name, ticker, type, chain, pitch, status)
values ('GTA Coin', 'GTA', 'crypto', 'Vice City Roleplay',
'A proposed in-server currency for roleplay jobs, businesses, shopping, and trading.', 'approved')
on conflict do nothing;
*/
