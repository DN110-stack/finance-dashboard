-- Phase E: track the original file name for each upload batch.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.upload_batches
  add column if not exists file_name text;
