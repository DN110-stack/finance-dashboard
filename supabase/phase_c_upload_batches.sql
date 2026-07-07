-- Phase C: multi-file upload + duplicate detection + upload history.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

create table if not exists public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_bank text not null,
  transaction_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Deleting a batch cascades to every transaction that belongs to it.
alter table public.transactions
  add column if not exists batch_id uuid references public.upload_batches (id) on delete cascade;

create index if not exists upload_batches_user_id_idx on public.upload_batches (user_id);
create index if not exists transactions_batch_id_idx on public.transactions (batch_id);

alter table public.upload_batches enable row level security;

create policy "upload_batches_select_own" on public.upload_batches
  for select using (auth.uid() = user_id);
create policy "upload_batches_insert_own" on public.upload_batches
  for insert with check (auth.uid() = user_id);
create policy "upload_batches_update_own" on public.upload_batches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "upload_batches_delete_own" on public.upload_batches
  for delete using (auth.uid() = user_id);
