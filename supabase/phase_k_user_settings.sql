-- Phase K: per-user app settings — financial year preference and default
-- budget view. One row per user, upserted by user_id the same way budgets
-- upserts on (category, month).
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  financial_year_preference text not null default 'calendar',
  default_budget_view text not null default 'monthly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_fy_pref_valid check (
    financial_year_preference in ('calendar', 'financial')
  ),
  constraint user_settings_default_view_valid check (
    default_budget_view in ('monthly', 'annual')
  ),
  -- One settings row per user — this is what makes upsert-by-user_id safe,
  -- mirroring how budgets' unique (user_id, category, month) makes
  -- upsertBudget safe without an id lookup first.
  unique (user_id)
);

alter table public.user_settings enable row level security;

-- Each user can only see and modify their own row.
create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings_delete_own" on public.user_settings
  for delete using (auth.uid() = user_id);
