-- Phase I: budget groups — bundle several categories under one combined
-- monthly budget (e.g. "Food & Dining" = Groceries + Dining Out + Coffee).
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.budget_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  month text not null, -- "YYYY-MM"
  amount numeric(12, 2) not null,
  categories text[] not null,
  created_at timestamptz not null default now(),
  constraint budget_groups_month_format check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint budget_groups_amount_nonnegative check (amount >= 0),
  constraint budget_groups_categories_nonempty check (array_length(categories, 1) >= 1)
);

create index if not exists budget_groups_user_id_month_idx on public.budget_groups (user_id, month);

alter table public.budget_groups enable row level security;

-- Each user can only see and modify their own rows. Enforcing "a category
-- belongs to at most one budget or group per month" across this table and
-- `budgets` isn't expressible as a plain SQL constraint (it spans two tables
-- and an array column), so that invariant is enforced client-side instead —
-- see app/budget/BudgetManager.tsx.
create policy "budget_groups_select_own" on public.budget_groups
  for select using (auth.uid() = user_id);
create policy "budget_groups_insert_own" on public.budget_groups
  for insert with check (auth.uid() = user_id);
create policy "budget_groups_update_own" on public.budget_groups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budget_groups_delete_own" on public.budget_groups
  for delete using (auth.uid() = user_id);
