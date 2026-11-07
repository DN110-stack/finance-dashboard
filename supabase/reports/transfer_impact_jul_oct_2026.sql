-- Read-only report: Jul-Oct 2026 income, expenses and savings rate before and
-- after leaving transfer categories out. One-off transactions are excluded in
-- both, matching the dashboard's default.
-- Run in the Supabase SQL Editor AFTER phase_p_category_kind.sql. It changes
-- nothing. (The SQL Editor bypasses row level security, so this assumes the
-- database holds only your own data.)

with tx as (
  select
    date_trunc('month', t.date)::date as month,
    t.amount,
    coalesce(c.kind, 'expense') as kind
  from public.transactions t
  left join public.categories c
    on c.user_id = t.user_id and lower(c.name) = lower(t.category)
  where t.date >= '2026-07-01'
    and t.date <  '2026-11-01'
    and not coalesce(t.is_one_off, false)
),
monthly as (
  select
    month,
    coalesce(sum(amount)  filter (where amount > 0), 0)                         as income_before,
    coalesce(-sum(amount) filter (where amount < 0), 0)                         as expenses_before,
    coalesce(sum(amount)  filter (where amount > 0 and kind <> 'transfer'), 0)  as income_after,
    coalesce(-sum(amount) filter (where amount < 0 and kind <> 'transfer'), 0)  as expenses_after
  from tx
  group by month
)
select
  to_char(month, 'Mon YYYY') as month,
  round(income_before)   as income_before,
  round(income_after)    as income_after,
  round(expenses_before) as expenses_before,
  round(expenses_after)  as expenses_after,
  case when income_before > 0 then round((income_before - expenses_before) / income_before * 100) end as savings_rate_before_pct,
  case when income_after  > 0 then round((income_after  - expenses_after)  / income_after  * 100) end as savings_rate_after_pct
from monthly
order by monthly.month;
