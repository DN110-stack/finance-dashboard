-- Phase M: opening balance for the "Current Balance" dashboard card.
alter table public.user_settings
  add column if not exists opening_balance numeric(12, 2),
  add column if not exists opening_balance_date date;