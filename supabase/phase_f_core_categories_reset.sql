-- Phase F: reset to a flat set of 11 core categories (no preset sub-categories),
-- with per-category duplicate-safe seeding for new signups and backfill.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

-- Seeds the 11 core categories for a single user. Each core category is its
-- own parent (self-grouped) rather than a child of anything, since there are
-- no preset sub-categories anymore. Case-insensitively skips any category
-- that already exists for that user, so this is safe to re-run for backfill
-- without ever creating a duplicate.
create or replace function public.seed_default_categories(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, colour, parent_category)
  select target_user, preset.name, preset.colour, preset.name
  from (values
    ('Income', '#22c55e'),
    ('Housing', '#3b82f6'),
    ('Food', '#f97316'),
    ('Transport', '#8b5cf6'),
    ('Health', '#ec4899'),
    ('Finance', '#ef4444'),
    ('Shopping', '#f59e0b'),
    ('Entertainment', '#06b6d4'),
    ('Personal Care', '#d946ef'),
    ('Savings', '#14b8a6'),
    ('Other', '#94a3b8')
  ) as preset(name, colour)
  where not exists (
    select 1 from public.categories existing
    where existing.user_id = target_user
      and lower(existing.name) = lower(preset.name)
  );
end;
$$;

-- Seed presets for every new signup — unchanged, re-created here for clarity.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill the 11 core categories for every existing user. Safe/idempotent —
-- the per-category NOT EXISTS check above skips anything already present.
select public.seed_default_categories(id) from auth.users;
