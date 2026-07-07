-- Finance dashboard schema.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  colour text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  description text not null,
  category text not null,
  amount numeric(12, 2) not null,
  source_bank text,
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  keyword text not null,
  category_id uuid references public.categories (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_id_date_idx on public.transactions (user_id, date);
create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists transaction_rules_user_id_idx on public.transaction_rules (user_id);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_rules enable row level security;

-- Each user can only see and modify their own rows.

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

create policy "transaction_rules_select_own" on public.transaction_rules
  for select using (auth.uid() = user_id);
create policy "transaction_rules_insert_own" on public.transaction_rules
  for insert with check (auth.uid() = user_id);
create policy "transaction_rules_update_own" on public.transaction_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transaction_rules_delete_own" on public.transaction_rules
  for delete using (auth.uid() = user_id);
