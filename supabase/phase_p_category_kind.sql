-- Phase P: classify categories as income, expense or transfer, so money moving
-- between your own accounts (and credit card payments) can be left out of
-- income, spending and savings figures.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.categories
  add column if not exists kind text not null default 'expense';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_kind_valid'
  ) then
    alter table public.categories
      add constraint categories_kind_valid check (kind in ('income', 'expense', 'transfer'));
  end if;
end
$$;

-- Backfill from names. Matching is case-insensitive.
--   income:   everything under the Income parent, plus Business Income
--   transfer: everything under the Transfers parent, plus the three named below
update public.categories
  set kind = 'income'
  where lower(coalesce(parent_category, '')) = 'income'
     or lower(name) in ('income', 'business income');

update public.categories
  set kind = 'transfer'
  where lower(coalesce(parent_category, '')) = 'transfers'
     or lower(name) in ('transfers', 'account transfers', 'card payments', 'property & renovation');

-- Review: how every category was classified. Check that nothing you expect
-- to be a transfer or income is still listed as an expense.
select kind, coalesce(parent_category, '(none)') as parent, name
from public.categories
order by kind, parent, name;
