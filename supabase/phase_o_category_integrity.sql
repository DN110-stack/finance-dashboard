-- Phase O: keep every reference to a category in sync when it is renamed,
-- and stop a category that's still in use from being deleted out from under
-- its transactions, budgets, goals and bills.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new
--
-- Categories are still referenced by NAME in transactions, budgets,
-- budget_groups, annual_budgets, goals and bills. These functions are the
-- single place that knows about all of those references. They run as the
-- calling user (security invoker), so row level security still applies, and
-- every statement is also scoped to auth.uid() explicitly.

-- Replaces `old_name` with `new_name` inside a list of category names
-- (case-insensitive match), keeping the original order and dropping any
-- duplicate the replacement creates.
create or replace function public.replace_category_in_array(
  arr text[],
  old_name text,
  new_name text
)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(name order by first_pos), '{}')
  from (
    select name, min(pos) as first_pos
    from (
      select
        case when lower(item) = lower(old_name) then new_name else item end as name,
        pos
      from unnest(arr) with ordinality as t(item, pos)
    ) replaced
    group by name
  ) deduped
$$;

-- Counts every record that references `p_name`, per kind.
create or replace function public.count_category_usage(p_user uuid, p_name text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'transactions', (select count(*) from public.transactions
                     where user_id = p_user and lower(category) = lower(p_name)),
    'budgets', (select count(*) from public.budgets
                where user_id = p_user and lower(category) = lower(p_name)),
    'budget_groups', (select count(*) from public.budget_groups g
                      where g.user_id = p_user
                        and exists (select 1 from unnest(g.categories) c where lower(c) = lower(p_name))),
    'annual_budgets', (select count(*) from public.annual_budgets a
                       where a.user_id = p_user
                         and (lower(coalesce(a.category, '')) = lower(p_name)
                           or exists (select 1 from unnest(coalesce(a.group_categories, '{}')) c
                                      where lower(c) = lower(p_name)))),
    'goals', (select count(*) from public.goals
              where user_id = p_user and lower(coalesce(category, '')) = lower(p_name)),
    'bills', (select count(*) from public.bills
              where user_id = p_user and lower(coalesce(category, '')) = lower(p_name))
  )
$$;

-- Rewrites every name reference from `p_old` to `p_new`. Returns how many
-- rows of each kind changed.
create or replace function public.cascade_category_name(p_user uuid, p_old text, p_new text)
returns jsonb
language plpgsql
as $$
declare
  n_tx int;
  n_budgets int;
  n_groups int;
  n_annual int;
  n_annual_groups int;
  n_goals int;
  n_bills int;
begin
  update public.transactions set category = p_new
    where user_id = p_user and lower(category) = lower(p_old);
  get diagnostics n_tx = row_count;

  update public.budgets set category = p_new
    where user_id = p_user and lower(category) = lower(p_old);
  get diagnostics n_budgets = row_count;

  update public.budget_groups
    set categories = public.replace_category_in_array(categories, p_old, p_new)
    where user_id = p_user
      and exists (select 1 from unnest(categories) c where lower(c) = lower(p_old));
  get diagnostics n_groups = row_count;

  update public.annual_budgets set category = p_new
    where user_id = p_user and lower(coalesce(category, '')) = lower(p_old);
  get diagnostics n_annual = row_count;

  update public.annual_budgets
    set group_categories = public.replace_category_in_array(group_categories, p_old, p_new)
    where user_id = p_user
      and group_categories is not null
      and exists (select 1 from unnest(group_categories) c where lower(c) = lower(p_old));
  get diagnostics n_annual_groups = row_count;

  update public.goals set category = p_new
    where user_id = p_user and lower(coalesce(category, '')) = lower(p_old);
  get diagnostics n_goals = row_count;

  update public.bills set category = p_new
    where user_id = p_user and lower(coalesce(category, '')) = lower(p_old);
  get diagnostics n_bills = row_count;

  return jsonb_build_object(
    'transactions', n_tx,
    'budgets', n_budgets,
    'budget_groups', n_groups,
    'annual_budgets', n_annual + n_annual_groups,
    'goals', n_goals,
    'bills', n_bills
  );
exception
  when unique_violation then
    raise exception 'Both categories already have a budget for the same period. Remove one of those budgets first, then try again.';
end;
$$;

-- Renames / recolours / re-parents a category and cascades a name change to
-- every table that references it, all in one transaction.
create or replace function public.rename_category(
  p_id uuid,
  p_name text,
  p_colour text,
  p_parent text
)
returns jsonb
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_old text;
  v_new text := btrim(p_name);
  v_counts jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'You must be logged in to edit categories';
  end if;
  if v_new = '' then
    raise exception 'A category needs a name';
  end if;

  select name into v_old from public.categories where id = p_id and user_id = v_user;
  if v_old is null then
    raise exception 'Category not found';
  end if;

  if exists (
    select 1 from public.categories
    where user_id = v_user and id <> p_id and lower(name) = lower(v_new)
  ) then
    raise exception '"%" already exists as a category', v_new;
  end if;

  update public.categories
    set name = v_new, colour = p_colour, parent_category = p_parent
    where id = p_id and user_id = v_user;

  if v_old <> v_new then
    v_counts := public.cascade_category_name(v_user, v_old, v_new);
  end if;

  return v_counts;
end;
$$;

-- How many records still use a category — the app calls this before a
-- delete so it can offer to move them.
create or replace function public.category_usage(p_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
begin
  select name into v_name from public.categories where id = p_id and user_id = v_user;
  if v_name is null then
    raise exception 'Category not found';
  end if;
  return public.count_category_usage(v_user, v_name);
end;
$$;

-- Deletes a category. If anything still uses it, p_move_to must name another
-- category to take those records over — otherwise the delete is refused
-- rather than leaving orphaned records behind. Saved keyword rules that
-- pointed at the deleted category move to the new one as well.
create or replace function public.delete_category(p_id uuid, p_move_to uuid default null)
returns jsonb
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_target text;
  v_usage jsonb;
  v_total int;
  v_counts jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'You must be logged in to delete categories';
  end if;

  select name into v_name from public.categories where id = p_id and user_id = v_user;
  if v_name is null then
    raise exception 'Category not found';
  end if;

  v_usage := public.count_category_usage(v_user, v_name);
  select coalesce(sum(value::int), 0) into v_total from jsonb_each_text(v_usage);

  if v_total > 0 then
    if p_move_to is null then
      raise exception '"%" is still used by % record(s). Choose a category to move them to.', v_name, v_total;
    end if;
    if p_move_to = p_id then
      raise exception 'Choose a different category to move the records to';
    end if;

    select name into v_target from public.categories where id = p_move_to and user_id = v_user;
    if v_target is null then
      raise exception 'The category to move records to was not found';
    end if;

    v_counts := public.cascade_category_name(v_user, v_name, v_target);
    update public.transaction_rules set category_id = p_move_to
      where user_id = v_user and category_id = p_id;
  end if;

  delete from public.categories where id = p_id and user_id = v_user;
  return v_counts;
end;
$$;
