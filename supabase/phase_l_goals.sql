-- Phase L: savings/spending/debt goals.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  target_amount numeric(12, 2) not null,
  current_amount numeric(12, 2) not null default 0,
  target_date date not null,
  category text,
  -- Debt-only: the balance the goal started from and the recurring payment
  -- used to log progress and project a payoff date. Null for savings/spending.
  starting_balance numeric(12, 2),
  monthly_payment numeric(12, 2),
  colour text not null default '#3b82f6',
  emoji text not null default '🎯',
  notes text,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint goals_type_valid check (type in ('savings', 'spending', 'debt')),
  constraint goals_target_amount_nonnegative check (target_amount >= 0),
  constraint goals_current_amount_nonnegative check (current_amount >= 0)
);

create index if not exists goals_user_id_idx on public.goals (user_id);

alter table public.goals enable row level security;

-- Each user can only see and modify their own rows.
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);
