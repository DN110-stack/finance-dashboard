-- Phase J: annual budgets — a yearly amount per category or category group,
-- set independently from the monthly budgets in `budgets`/`budget_groups`.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.annual_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text, -- set when is_group = false; null for groups
  amount numeric(12, 2) not null,
  year text not null, -- "YYYY"
  is_group boolean not null default false,
  group_categories text[], -- set when is_group = true; null for single-category rows
  group_name text, -- set when is_group = true; null for single-category rows
  created_at timestamptz not null default now(),
  constraint annual_budgets_year_format check (year ~ '^\d{4}$'),
  constraint annual_budgets_amount_nonnegative check (amount >= 0),
  -- A row is either a single-category budget (category set, group fields
  -- null) or a group budget (group fields set, category null) — never both,
  -- never neither.
  constraint annual_budgets_shape check (
    (is_group = false and category is not null and group_name is null and group_categories is null)
    or
    (is_group = true and group_name is not null and category is null
      and group_categories is not null and array_length(group_categories, 1) >= 1)
  ),
  -- At most one single-category annual budget per category per year — NULL
  -- `category` values (group rows) aren't compared for uniqueness, so this
  -- doesn't constrain groups at all. Group name uniqueness per year is
  -- enforced client-side instead, matching `budget_groups` — see
  -- app/budget/AnnualBudgetManager.tsx.
  unique (user_id, category, year)
);

create index if not exists annual_budgets_user_id_year_idx on public.annual_budgets (user_id, year);

alter table public.annual_budgets enable row level security;

-- Each user can only see and modify their own rows.
create policy "annual_budgets_select_own" on public.annual_budgets
  for select using (auth.uid() = user_id);
create policy "annual_budgets_insert_own" on public.annual_budgets
  for insert with check (auth.uid() = user_id);
create policy "annual_budgets_update_own" on public.annual_budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "annual_budgets_delete_own" on public.annual_budgets
  for delete using (auth.uid() = user_id);
