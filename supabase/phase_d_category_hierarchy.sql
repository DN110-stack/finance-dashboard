-- Phase D: preset parent/child category hierarchy.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.categories
  add column if not exists parent_category text;

-- Seeds the 11 preset parent categories (and their children) for a single
-- user. No-ops if that user already has any category rows, so it's safe to
-- run repeatedly for backfill and idempotent as a signup trigger.
create or replace function public.seed_default_categories(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.categories where user_id = target_user) then
    return;
  end if;

  insert into public.categories (user_id, name, colour, parent_category) values
    (target_user, 'Salary/Wages', '#16a34a', 'Income'),
    (target_user, 'Freelance', '#16a34a', 'Income'),
    (target_user, 'Government Payments', '#16a34a', 'Income'),
    (target_user, 'Investment Income', '#16a34a', 'Income'),
    (target_user, 'Transfers In', '#16a34a', 'Income'),

    (target_user, 'Rent/Mortgage', '#3b82f6', 'Housing'),
    (target_user, 'Utilities', '#3b82f6', 'Housing'),
    (target_user, 'Internet/Phone', '#3b82f6', 'Housing'),
    (target_user, 'Home Maintenance', '#3b82f6', 'Housing'),

    (target_user, 'Groceries', '#ea580c', 'Food'),
    (target_user, 'Dining Out', '#ea580c', 'Food'),
    (target_user, 'Coffee', '#ea580c', 'Food'),

    (target_user, 'Fuel', '#059669', 'Transport'),
    (target_user, 'Public Transport', '#059669', 'Transport'),
    (target_user, 'Rideshare', '#059669', 'Transport'),
    (target_user, 'Registration/Insurance', '#059669', 'Transport'),

    (target_user, 'Medical', '#ef4444', 'Health'),
    (target_user, 'Pharmacy', '#ef4444', 'Health'),
    (target_user, 'Gym/Fitness', '#ef4444', 'Health'),
    (target_user, 'Health Insurance', '#ef4444', 'Health'),

    (target_user, 'Loan Repayments', '#d97706', 'Finance'),
    (target_user, 'Credit Card', '#d97706', 'Finance'),
    (target_user, 'Buy Now Pay Later', '#d97706', 'Finance'),
    (target_user, 'Bank Fees', '#d97706', 'Finance'),

    (target_user, 'Clothing', '#ec4899', 'Shopping'),
    (target_user, 'Electronics', '#ec4899', 'Shopping'),
    (target_user, 'Home Goods', '#ec4899', 'Shopping'),

    (target_user, 'Subscriptions', '#8b5cf6', 'Entertainment'),
    (target_user, 'Events/Activities', '#8b5cf6', 'Entertainment'),
    (target_user, 'Hobbies', '#8b5cf6', 'Entertainment'),

    (target_user, 'Haircut', '#c026d3', 'Personal Care'),
    (target_user, 'Beauty/Cosmetics', '#c026d3', 'Personal Care'),

    (target_user, 'Transfers to Savings', '#0d9488', 'Savings'),
    (target_user, 'Investments', '#0d9488', 'Savings'),

    (target_user, 'Gifts', '#64748b', 'Other'),
    (target_user, 'Charity', '#64748b', 'Other'),
    (target_user, 'Miscellaneous', '#64748b', 'Other');
end;
$$;

-- Seed presets for every new signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-off backfill for accounts that already exist. Safe to re-run — the
-- helper skips any user who already has category rows.
select public.seed_default_categories(id) from auth.users;
