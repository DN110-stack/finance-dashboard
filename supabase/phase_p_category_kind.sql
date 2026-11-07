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

-- New users get the Income core category classified as income; every other
-- default stays an expense. (Same function as phase F, plus the kind column.)
create or replace function public.seed_default_categories(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, colour, parent_category, kind)
  select target_user, preset.name, preset.colour, preset.name,
         case when preset.name = 'Income' then 'income' else 'expense' end
  from (values
    ('Income', '#22c55e'),
    ('Housing', '#3b82f6'),
    ('Food', '#f97316'),
    ('Transport', '#8b5cf6'),
    ('Health', '#ec4899'),
    ('Finance', '#ef4444'),
    ('Shopping', '#f59e0b'),
    ('Entertainment', '#06b6d4'),
    ('Personal Care', '#d946ef'),
    ('Savings', '#14b8a6'),
    ('Other', '#94a3b8')
  ) as preset(name, colour)
  where not exists (
    select 1 from public.categories existing
    where existing.user_id = target_user
      and lower(existing.name) = lower(preset.name)
  );
end;
$$;

-- Review: how every category was classified. Check that nothing you expect
-- to be a transfer or income is still listed as an expense.
select kind, coalesce(parent_category, '(none)') as parent, name
from public.categories
order by kind, parent, name;
