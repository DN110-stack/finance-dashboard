-- STEP 2 of 2: set up November 2026 budgets.
--   * Monthly Spend group = Eating Out & Takeaway + Shopping + Entertainment, $1,000
--   * Groceries $750, Petrol $500, Other $400 as single budgets
-- Eating Out & Takeaway and Shopping get NO single budget: the app doesn't allow
-- a category in a group and a single budget in the same month, and it would
-- count that spending twice.
--
-- Safe to re-run: existing budgets are updated, never duplicated, and nothing
-- is deleted. Everything runs in one transaction, and it stops with an error
-- (changing nothing) if any category name below doesn't exist on your account.
--
-- Only November 2026 is created. Use the Budget page's "Copy" button to roll
-- them forward to later months.

do $$
declare
  v_user uuid;
  v_month text := '2026-11';
  rec record;
  v_name text;
  v_cats text[];
begin
  select user_id into v_user
    from public.transactions group by user_id order by count(*) desc limit 1;
  if v_user is null then
    raise exception 'No account with transactions found';
  end if;

  -- Single budgets (updates the amount if the category already has one this month).
  for rec in
    select * from (values ('Groceries', 750), ('Petrol', 500), ('Other', 400)) as t(cat, amt)
  loop
    select name into v_name from public.categories
      where user_id = v_user and lower(name) = lower(rec.cat);
    if v_name is null then
      raise exception 'Category "%" not found on your account', rec.cat;
    end if;

    insert into public.budgets (user_id, category, amount, month, period_type, period_amount)
      values (v_user, v_name, rec.amt, v_month, 'monthly', null)
      on conflict (user_id, category, month)
      do update set amount = excluded.amount, period_type = 'monthly', period_amount = null;
  end loop;

  -- The Monthly Spend group, using each category's exact stored name.
  select array_agg(c.name order by t.ord) into v_cats
    from (values ('Eating Out & Takeaway', 1), ('Shopping', 2), ('Entertainment', 3)) as t(cat, ord)
    join public.categories c on c.user_id = v_user and lower(c.name) = lower(t.cat);

  if coalesce(array_length(v_cats, 1), 0) <> 3 then
    raise exception 'Could not find all of Eating Out & Takeaway, Shopping and Entertainment (found: %)',
      coalesce(array_to_string(v_cats, ', '), 'none');
  end if;

  update public.budget_groups
    set amount = 1000, categories = v_cats
    where user_id = v_user and month = v_month and lower(name) = 'monthly spend';

  if not found then
    insert into public.budget_groups (user_id, name, month, amount, categories)
      values (v_user, 'Monthly Spend', v_month, 1000, v_cats);
  end if;
end
$$;

-- Result: every November 2026 budget now on your account. Look for any
-- single budget on Eating Out & Takeaway, Shopping or Entertainment — if one
-- is listed, it overlaps the group and you should remove it on the Budget page.
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
