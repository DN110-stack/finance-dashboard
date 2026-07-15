-- Phase H: per-category monthly budgets.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  amount numeric(12, 2) not null,
  month text not null, -- "YYYY-MM"
  created_at timestamptz not null default now(),
  constraint budgets_month_format check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint budgets_amount_nonnegative check (amount >= 0),
  -- At most one budget per category per month, so "Save" always upserts
  -- rather than piling up duplicate rows.
  unique (user_id, category, month)
);

create index if not exists budgets_user_id_month_idx on public.budgets (user_id, month);

alter table public.budgets enable row level security;

-- Each user can only see and modify their own rows.
create policy "budgets_select_own" on public.budgets
  for select using (auth.uid() = user_id);
create policy "budgets_insert_own" on public.budgets
  for insert with check (auth.uid() = user_id);
create policy "budgets_update_own" on public.budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budgets_delete_own" on public.budgets
  for delete using (auth.uid() = user_id);
