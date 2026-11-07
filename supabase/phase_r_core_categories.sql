-- Phase R: rename and hide core categories.
-- Core categories (Housing, Transport, ...) were identified by their exact
-- names, so renaming one would have broken ordering and parent pickers. Each
-- core row now carries a permanent `core_key`, and any category can be hidden
-- from pickers without being deleted.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.categories
  add column if not exists core_key text,
  add column if not exists is_hidden boolean not null default false;

-- Tag the self-parented rows whose name is one of the 11 core names.
update public.categories c
  set core_key = core.name
  from (values
    ('Income'), ('Housing'), ('Food'), ('Transport'), ('Health'), ('Finance'),
    ('Shopping'), ('Entertainment'), ('Personal Care'), ('Savings'), ('Other')
  ) as core(name)
  where c.core_key is null
    and lower(c.name) = lower(core.name)
    and lower(coalesce(c.parent_category, '')) = lower(c.name);

create unique index if not exists categories_user_core_key_idx
  on public.categories (user_id, core_key)
  where core_key is not null;

-- Same as phase O's rename_category, plus: renaming a parent row (one whose
-- parent is itself, like a core category) also renames the parent of every
-- category filed under it, so nothing is left pointing at the old name.
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
  v_old_parent text;
  v_new text := btrim(p_name);
  v_is_parent_row boolean;
  v_counts jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'You must be logged in to edit categories';
  end if;
  if v_new = '' then
    raise exception 'A category needs a name';
  end if;

  select name, parent_category into v_old, v_old_parent
    from public.categories where id = p_id and user_id = v_user;
  if v_old is null then
    raise exception 'Category not found';
  end if;

  if exists (
    select 1 from public.categories
    where user_id = v_user and id <> p_id and lower(name) = lower(v_new)
  ) then
    raise exception '"%" already exists as a category', v_new;
  end if;

  v_is_parent_row := lower(coalesce(v_old_parent, '')) = lower(v_old);

  update public.categories
    set name = v_new,
        colour = p_colour,
        parent_category = case when v_is_parent_row then v_new else p_parent end
    where id = p_id and user_id = v_user;

  if v_is_parent_row and v_old <> v_new then
    update public.categories
      set parent_category = v_new
      where user_id = v_user and id <> p_id and lower(coalesce(parent_category, '')) = lower(v_old);
  end if;

  if v_old <> v_new then
    v_counts := public.cascade_category_name(v_user, v_old, v_new);
  end if;

  return v_counts;
end;
$$;

-- Hides / unhides a category. Hiding is refused while anything still uses
-- the category, or while other categories are filed under it — hiding is for
-- clutter you don't use, not a way to lose track of real data.
create or replace function public.set_category_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_total int;
  v_children int;
begin
  if v_user is null then
    raise exception 'You must be logged in to edit categories';
  end if;

  select name into v_name from public.categories where id = p_id and user_id = v_user;
  if v_name is null then
    raise exception 'Category not found';
  end if;

  if p_hidden then
    select coalesce(sum(value::int), 0) into v_total
      from jsonb_each_text(public.count_category_usage(v_user, v_name));
    if v_total > 0 then
      raise exception '"%" is still used by % record(s), so it can''t be hidden. Move them to another category first.', v_name, v_total;
    end if;

    select count(*) into v_children from public.categories
      where user_id = v_user and id <> p_id and lower(coalesce(parent_category, '')) = lower(v_name);
    if v_children > 0 then
      raise exception '"%" has % categor(ies) filed under it, so it can''t be hidden.', v_name, v_children;
    end if;
  end if;

  update public.categories set is_hidden = p_hidden where id = p_id and user_id = v_user;
end;
$$;

-- Review: your core categories, with their permanent keys.
select core_key, name, is_hidden
from public.categories
where core_key is not null
order by core_key;
