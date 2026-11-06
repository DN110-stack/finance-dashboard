-- Phase N: recurring bills (fixed outgoings) and manual paid markers.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null,
  frequency text not null,
  -- The first (anchor) due date. Later due dates are derived from it.
  due_date date not null,
  end_date date,
  category text,
  -- True for bills like utilities where `amount` is only an estimate.
  amount_varies boolean not null default false,
  -- Text looked for in transaction descriptions to auto-mark a bill paid.
  -- Falls back to the bill name when null.
  match_keyword text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint bills_frequency_valid check (
    frequency in ('weekly', 'fortnightly', 'monthly', 'quarterly', 'bi-annual', 'annual')
  ),
  constraint bills_amount_nonnegative check (amount >= 0)
);

create index if not exists bills_user_id_idx on public.bills (user_id);

alter table public.bills enable row level security;

create policy "bills_select_own" on public.bills
  for select using (auth.uid() = user_id);
create policy "bills_insert_own" on public.bills
  for insert with check (auth.uid() = user_id);
create policy "bills_update_own" on public.bills
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bills_delete_own" on public.bills
  for delete using (auth.uid() = user_id);

-- One row per occurrence the user has manually marked as paid.
create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  due_date date not null,
  created_at timestamptz not null default now(),
  constraint bill_payments_unique_occurrence unique (bill_id, due_date)
);

create index if not exists bill_payments_user_id_idx on public.bill_payments (user_id);

alter table public.bill_payments enable row level security;

create policy "bill_payments_select_own" on public.bill_payments
  for select using (auth.uid() = user_id);
create policy "bill_payments_insert_own" on public.bill_payments
  for insert with check (auth.uid() = user_id);
create policy "bill_payments_delete_own" on public.bill_payments
  for delete using (auth.uid() = user_id);
