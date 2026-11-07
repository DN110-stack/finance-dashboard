-- Phase Q: categorisation rules.
-- Extends the existing transaction_rules table (keyword -> category) instead of
-- adding a second rules table: rules gain a match type, a debit/credit filter,
-- an explicit priority, an on/off switch and an optional whole-word match.
-- `keyword` stays as the column holding the pattern.
-- Also adds a "set by hand" marker on transactions, so rules never overwrite a
-- category you chose yourself.
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/togzyobiigfaxbwmstzf/sql/new

alter table public.transaction_rules
  add column if not exists match_type text not null default 'contains',
  add column if not exists amount_sign text not null default 'any',
  add column if not exists priority integer not null default 0,
  add column if not exists enabled boolean not null default true,
  add column if not exists whole_word boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transaction_rules_match_type_valid') then
    alter table public.transaction_rules
      add constraint transaction_rules_match_type_valid
      check (match_type in ('contains', 'starts_with', 'regex'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transaction_rules_amount_sign_valid') then
    alter table public.transaction_rules
      add constraint transaction_rules_amount_sign_valid
      check (amount_sign in ('any', 'debit', 'credit'));
  end if;
end
$$;

alter table public.transactions
  add column if not exists category_locked boolean not null default false;

-- Until now the longest matching keyword won. Lower priority numbers now win,
-- so give the rules you already have priorities that reproduce that order.
-- (Only rules still at the default 0 are touched, so re-running is safe.)
with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by length(trim(keyword)) desc, created_at, id
         ) as rn
  from public.transaction_rules
  where priority = 0
)
update public.transaction_rules r
  set priority = ranked.rn
  from ranked
  where r.id = ranked.id;

-- Starter rules. They go after your existing rules (priority-wise), in the
-- order listed — the first matching rule wins. A rule is skipped if one with
-- the same pattern, match type and sign already exists, and any rule whose
-- category doesn't exist yet is skipped and reported in the result below.
with seed(ord, pattern, match_type, amount_sign, whole_word, category_name) as (
  values
    (1,  'Linked Acc Trns',            'contains',    'any',    false, 'Account Transfers'),
    (2,  'TFR FROM Westpa',            'contains',    'any',    false, 'Account Transfers'),
    (3,  'Funds trns',                 'contains',    'any',    false, 'Account Transfers'),
    (4,  'PAYMENT - CASH THANK YOU',   'contains',    'any',    false, 'Card Payments'),
    (5,  'Plenti',                     'contains',    'credit', false, 'Dylan Pay'),
    (6,  'WAGES ZIPMONEY',             'contains',    'credit', false, 'Dylan Pay'),
    (7,  'GEORGINA LUPANGGina',        'contains',    'credit', false, 'Gina Pay'),
    (8,  '^ATO\d',                     'regex',       'credit', false, 'Other Income'),
    (9,  'HEDGECOCK SUPERFUND',        'contains',    'debit',  false, 'Super Contributions'),
    (10, 'INBEAUTE',                   'contains',    'debit',  false, 'Business Expenses'),
    (11, 'ACUITY SCHEDULING',          'contains',    'debit',  false, 'Business Expenses'),
    (12, 'ST ANDREWS CHILD',           'contains',    'debit',  false, 'Childcare'),
    (13, 'PUREBABY',                   'contains',    'debit',  false, 'Kids'),
    (14, 'DUCKIES',                    'contains',    'debit',  false, 'Kids'),
    (15, 'Love to dream',              'contains',    'debit',  false, 'Kids'),
    (16, 'ZIPPLUS',                    'contains',    'debit',  false, 'Buy Now Pay Later'),
    (17, 'INTEREST CHARGES',           'contains',    'debit',  false, 'Bank Fees & Interest'),
    (18, 'CASH ADVANCE FEE',           'contains',    'debit',  false, 'Bank Fees & Interest'),
    (19, 'TATTS',                      'contains',    'debit',  true,  'Entertainment'),
    (20, 'U GO',                       'contains',    'debit',  true,  'Petrol'),
    (21, '7-ELEVEN',                   'contains',    'debit',  false, 'Petrol'),
    (22, 'SPEEDWAY',                   'contains',    'debit',  false, 'Petrol'),
    (23, 'EG GROUP',                   'contains',    'debit',  false, 'Petrol'),
    (24, 'METRO PETROLEUM',            'contains',    'debit',  false, 'Petrol'),
    (25, 'COSTCO GAS',                 'contains',    'debit',  false, 'Petrol'),
    (26, 'SHELL',                      'contains',    'debit',  true,  'Petrol'),
    (27, '^BP ',                       'regex',       'debit',  false, 'Petrol'),
    (28, '^OTR ',                      'regex',       'debit',  false, 'Petrol'),
    (29, 'ETOLL',                      'contains',    'debit',  false, 'Tolls & Parking'),
    (30, 'PARKING',                    'contains',    'debit',  false, 'Tolls & Parking'),
    (31, 'EasyPark',                   'contains',    'debit',  false, 'Tolls & Parking'),
    (32, 'CARE PARK',                  'contains',    'debit',  false, 'Tolls & Parking'),
    (33, 'NRMA Insurance',             'contains',    'debit',  false, 'Insurance, CTP & Rego'),
    (34, 'AGL',                        'contains',    'debit',  true,  'Energy'),
    (35, 'SYDNEY WATER',               'contains',    'debit',  false, 'Rates & Water'),
    (36, 'FAIRFIELD COUNCIL 327983',   'contains',    'debit',  false, 'Rates & Water'),
    (37, 'AUSSIE BROADBAND',           'contains',    'debit',  false, 'Internet & Phones'),
    (38, 'JB HIFI MOBILE',             'contains',    'debit',  false, 'Internet & Phones'),
    (39, 'Hospitals Contri',           'contains',    'debit',  false, 'Health Insurance'),
    (40, 'CHEMIST WAREHOUSE',          'contains',    'debit',  false, 'Medical & Pharmacy'),
    (41, 'PHARMACY',                   'contains',    'debit',  false, 'Medical & Pharmacy'),
    (42, 'PLINE',                      'contains',    'debit',  true,  'Medical & Pharmacy'),
    (43, 'Pilates',                    'contains',    'debit',  false, 'Fitness'),
    (44, 'PRIME VIDE',                 'contains',    'debit',  false, 'Subscriptions'),
    (45, 'NETFLIX',                    'contains',    'debit',  false, 'Subscriptions'),
    (46, 'Spotify',                    'contains',    'debit',  false, 'Subscriptions'),
    (47, 'Google One',                 'contains',    'debit',  false, 'Subscriptions'),
    (48, 'APPLE.COM',                  'contains',    'debit',  false, 'Subscriptions'),
    (49, 'Hubbl',                      'contains',    'debit',  false, 'Subscriptions'),
    (50, 'UBER *ONE',                  'contains',    'debit',  false, 'Subscriptions'),
    (51, 'ALDI',                       'contains',    'debit',  true,  'Groceries'),
    (52, 'WOOLWORTHS',                 'contains',    'debit',  false, 'Groceries'),
    (53, 'COLES',                      'contains',    'debit',  true,  'Groceries'),
    (54, 'UBER *EATS',                 'contains',    'debit',  false, 'Eating Out & Takeaway'),
    (55, 'DOORDASH',                   'contains',    'debit',  false, 'Eating Out & Takeaway'),
    (56, 'TFNSW OPAL',                 'contains',    'debit',  false, 'Transport'),
    (57, 'TRANSPORTFORNSW',            'contains',    'debit',  false, 'Transport')
),
owners as (
  select distinct user_id from public.categories
),
resolved as (
  select o.user_id, s.ord, s.pattern, s.match_type, s.amount_sign, s.whole_word,
         s.category_name, c.id as category_id
  from owners o
  cross join seed s
  left join public.categories c
    on c.user_id = o.user_id and lower(c.name) = lower(s.category_name)
),
base as (
  select user_id, max(priority) as max_priority
  from public.transaction_rules
  group by user_id
),
inserted as (
  insert into public.transaction_rules
    (user_id, keyword, category_id, match_type, amount_sign, whole_word, priority, enabled)
  select r.user_id, r.pattern, r.category_id, r.match_type, r.amount_sign, r.whole_word,
         coalesce(b.max_priority, 0) + r.ord, true
  from resolved r
  left join base b on b.user_id = r.user_id
  where r.category_id is not null
    and not exists (
      select 1 from public.transaction_rules x
      where x.user_id = r.user_id
        and lower(x.keyword) = lower(r.pattern)
        and x.match_type = r.match_type
        and x.amount_sign = r.amount_sign
    )
  returning 1
)
select 'rules added' as result, count(*)::text as detail from inserted
union all
select 'categories not found (rules skipped)',
       coalesce(string_agg(distinct category_name, ', '), 'none')
from resolved where category_id is null;
