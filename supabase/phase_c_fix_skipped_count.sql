-- Corrective fix: upload_batches was created before this column existed in
-- the migration, so `create table if not exists` silently skipped adding it.
-- Run in the SQL Editor: https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.upload_batches
  add column if not exists skipped_count integer not null default 0;

alter table public.upload_batches
  add column if not exists transaction_count integer not null default 0;
