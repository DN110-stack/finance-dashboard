-- Phase T: allow one-off (non-recurring) bills.
-- Adds 'once' to the allowed bill frequencies. A one-off bill has a single
-- due date (the bill's due_date) and never repeats.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.bills
  drop constraint if exists bills_frequency_valid;

alter table public.bills
  add constraint bills_frequency_valid check (
    frequency in ('once', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'bi-annual', 'annual')
  );
