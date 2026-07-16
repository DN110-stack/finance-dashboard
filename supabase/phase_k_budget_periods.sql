-- Phase K: flexible budget periods — weekly / bi-monthly / quarterly /
-- bi-annual recurring budgets alongside the existing plain monthly ones.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.budgets
  add column if not exists period_type text not null default 'monthly',
  add column if not exists period_amount numeric(12, 2);

alter table public.budgets
  add constraint budgets_period_type_valid check (
    period_type in ('weekly', 'monthly', 'bi-monthly', 'quarterly', 'bi-annual', 'annual')
  );

alter table public.budgets
  add constraint budgets_period_amount_nonnegative check (
    period_amount is null or period_amount >= 0
  );

-- Keeps period_amount's presence consistent with period_type, mirroring
-- annual_budgets_shape's null/non-null pairing in phase_j.
alter table public.budgets
  add constraint budgets_period_shape check (
    (period_type = 'monthly' and period_amount is null)
    or (period_type <> 'monthly' and period_amount is not null)
  );

comment on column public.budgets.amount is
  'Monthly-equivalent amount — always populated. For period_type = monthly this is the raw figure the user entered; for every other period_type it is prorated from period_amount at write time, so all existing percent/spent/pace/BudgetVsActualChart math keeps working unchanged.';
comment on column public.budgets.period_amount is
  'Raw amount the user entered for one occurrence of period_type (e.g. $120 for a quarterly budget). Null for plain monthly rows, where amount already is the raw per-period figure.';
comment on column public.budgets.month is
  'Anchor month ("YYYY-MM"). For period_type = monthly this is simply that month''s budget, unchanged from Phase H. For every other period_type, this is the first month the recurring budget applies to; it recurs every N months from here indefinitely (see app/lib/budgetPeriods.ts:isMonthApplicable).';
