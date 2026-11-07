-- STEP 1 of 2 (read-only): what budgets exist for November 2026 right now.
-- Changes nothing. Run this first and check it against what you expect.
-- (The SQL Editor bypasses row level security, so this picks your account as
-- the user with the most transactions — the leftover test account is ignored.)

with me as (
  select user_id from public.transactions group by user_id order by count(*) desc limit 1
)
select 'single budget' as kind, b.category as name, b.amount, b.period_type
from public.budgets b join me on me.user_id = b.user_id
where b.month = '2026-11'
union all
select 'group budget', g.name || '  [' || array_to_string(g.categories, ', ') || ']', g.amount, 'monthly'
from public.budget_groups g join me on me.user_id = g.user_id
where g.month = '2026-11'
order by 1, 2;
