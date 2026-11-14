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
