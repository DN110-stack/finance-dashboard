-- Phase G: flag transactions as one-off so they can be excluded from
-- dashboard calculations while still being visible/manageable on the
-- Transactions page.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.transactions
  add column if not exists is_one_off boolean not null default false;
