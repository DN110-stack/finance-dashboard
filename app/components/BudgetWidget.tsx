"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, TriangleAlert, Wallet } from "lucide-react";
import { useBudgets } from "../context/BudgetsContext";
import { useCategories } from "../context/CategoriesContext";
import { useAnalysisTransactions } from "../lib/useAnalysisTransactions";
import type { Transaction } from "../lib/csv";
import { calculatePace, getCurrentMonthKey, shiftMonthKey, type PaceStatus } from "../lib/budgets";
import { formatPeriodLabel, getPeriodRange, toISODate, type PeriodState } from "../lib/period";
import { isMonthApplicable } from "../lib/budgetPeriods";
import {
  budgetLayoutStore,
  MAX_BUDGET_SLOTS,
  resolveBudgetLayout,
  type BudgetSlotValue,
} from "../lib/budgetLayout";
import DonutMeter from "../budget/DonutMeter";
import { Skeleton } from "./Skeleton";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const DEFAULT_SWATCH_COLOUR = "#71717a";

type BudgetWidgetItem = {
  key: string; // "single:<budget id>" or "group:<budget group id>"
  name: string;
  colour: string;
  amount: number;
  spent: number;
  percent: number;
  pace: PaceStatus | null;
};

// Every "YYYY-MM" month the [from, to] range touches, oldest first.
function monthKeysInRange(from: string, to: string): string[] {
  const keys: string[] = [];
  let cursor = from.slice(0, 7);
  const last = to.slice(0, 7);
  for (let i = 0; cursor <= last && i < 600; i++) {
    keys.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return keys;
}

function sumCategorySpent(
  transactions: Transaction[],
  category: string,
  range: { from: string; to: string }
): number {
  const target = category.toLowerCase();
  let total = 0;
  for (const t of transactions) {
    if (t.amount >= 0 || t.isOneOff) continue;
    if (t.date < range.from || t.date > range.to) continue;
    if (t.category.toLowerCase() !== target) continue;
    total += Math.abs(t.amount);
  }
  return total;
}

export default function BudgetWidget({ period }: { period: PeriodState }) {
  const { budgets, budgetGroups, isLoading: budgetsLoading } = useBudgets();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { transactions } = useAnalysisTransactions({ respectOneOffToggle: false });
  const isLoading = budgetsLoading || categoriesLoading;

  const storedLayout = useSyncExternalStore(
    budgetLayoutStore.subscribe,
    budgetLayoutStore.getSnapshot,
    budgetLayoutStore.getServerSnapshot
  );

  const range = useMemo(() => getPeriodRange(period), [period]);

  // Budgets follow the dashboard's period. A single calendar month shows
  // that month's budgets against that month's spending. A longer range adds
  // each month's budget up month by month and compares it with spending
  // across the whole range.
  const items = useMemo<BudgetWidgetItem[]>(() => {
    if (!range) return [];

    const months = monthKeysInRange(range.from, range.to);
    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
    const colourFor = (name: string) => categoryByName.get(name.toLowerCase())?.colour ?? DEFAULT_SWATCH_COLOUR;
    const list: BudgetWidgetItem[] = [];

    // Pace only means something for the current month, viewed as a whole month.
    const monthKey = months[0];
    const [year, month] = monthKey.split("-").map(Number);
    const coversWholeMonth =
      months.length === 1 &&
      range.from === toISODate(new Date(year, month - 1, 1)) &&
      range.to === toISODate(new Date(year, month, 0));
    const paceFor = (spent: number, amount: number) =>
      coversWholeMonth && monthKey === getCurrentMonthKey() ? calculatePace(spent, amount, monthKey) : null;

    if (months.length === 1) {
      for (const b of budgets) {
        if (!isMonthApplicable(b.month, b.periodType, monthKey)) continue;
        const spent = sumCategorySpent(transactions, b.category, range);
        list.push({
          key: `single:${b.id}`,
          name: b.category,
          colour: colourFor(b.category),
          amount: b.amount,
          spent,
          percent: b.amount > 0 ? (spent / b.amount) * 100 : 0,
          pace: paceFor(spent, b.amount),
        });
      }

      for (const g of budgetGroups) {
        if (g.month !== monthKey) continue;
        const spent = g.categories.reduce((sum, name) => sum + sumCategorySpent(transactions, name, range), 0);
        const swatchCategory = g.categories.map((name) => categoryByName.get(name.toLowerCase())).find(Boolean);
        list.push({
          key: `group:${g.id}`,
          name: g.name,
          colour: swatchCategory?.colour ?? DEFAULT_SWATCH_COLOUR,
          amount: g.amount,
          spent,
          percent: g.amount > 0 ? (spent / g.amount) * 100 : 0,
          pace: paceFor(spent, g.amount),
        });
      }

      return list;
    }

    // Several months: one entry per category / group, budgets summed.
    const amountByCategory = new Map<string, { name: string; amount: number }>();
    for (const b of budgets) {
      for (const m of months) {
        if (!isMonthApplicable(b.month, b.periodType, m)) continue;
        const key = b.category.toLowerCase();
        const entry = amountByCategory.get(key) ?? { name: b.category, amount: 0 };
        entry.amount += b.amount;
        amountByCategory.set(key, entry);
      }
    }
    for (const [key, { name, amount }] of amountByCategory) {
      const spent = sumCategorySpent(transactions, name, range);
      list.push({
        key: `single:cat:${key}`,
        name,
        colour: colourFor(name),
        amount,
        spent,
        percent: amount > 0 ? (spent / amount) * 100 : 0,
        pace: null,
      });
    }

    const groupsByName = new Map<string, { name: string; amount: number; categories: Set<string> }>();
    for (const g of budgetGroups) {
      if (!months.includes(g.month)) continue;
      const key = g.name.toLowerCase();
      const entry = groupsByName.get(key) ?? { name: g.name, amount: 0, categories: new Set<string>() };
      entry.amount += g.amount;
      g.categories.forEach((name) => entry.categories.add(name));
      groupsByName.set(key, entry);
    }
    for (const [key, { name, amount, categories: groupCategories }] of groupsByName) {
      const names = [...groupCategories];
      const spent = names.reduce((sum, categoryName) => sum + sumCategorySpent(transactions, categoryName, range), 0);
      const swatchCategory = names.map((n) => categoryByName.get(n.toLowerCase())).find(Boolean);
      list.push({
        key: `group:name:${key}`,
        name,
        colour: swatchCategory?.colour ?? DEFAULT_SWATCH_COLOUR,
        amount,
        spent,
        percent: amount > 0 ? (spent / amount) * 100 : 0,
        pace: null,
      });
    }

    return list;
  }, [budgets, budgetGroups, categories, transactions, range]);

  const slotCount = Math.min(MAX_BUDGET_SLOTS, items.length);
  const itemKeys = useMemo(() => items.map((item) => item.key), [items]);
  const layout = useMemo(
    () => resolveBudgetLayout(storedLayout, itemKeys, slotCount),
    [storedLayout, itemKeys, slotCount]
  );
  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);

  function updateSlot(index: number, key: BudgetSlotValue) {
    const next = [...layout];
    next[index] = key;
    budgetLayoutStore.set(next);
  }

  return (
    <>
      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/10 p-8 text-center dark:border-white/10">
          <Wallet className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No budgets yet — create one on the{" "}
            <Link href="/budget" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Budget page
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
        {range && (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            {formatPeriodLabel(range)}
            {monthKeysInRange(range.from, range.to).length > 1 ? " · budgets add up month by month" : ""}
          </p>
        )}
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {layout.map((selectedKey, index) => (
            <BudgetSlot
              key={index}
              items={items}
              selectedKey={selectedKey}
              item={selectedKey ? (itemByKey.get(selectedKey) ?? null) : null}
              onChange={(next) => updateSlot(index, next)}
            />
          ))}
        </div>
        </>
      )}
    </>
  );
}

function BudgetSlot({
  items,
  selectedKey,
  item,
  onChange,
}: {
  items: BudgetWidgetItem[];
  selectedKey: BudgetSlotValue;
  item: BudgetWidgetItem | null;
  onChange: (value: BudgetSlotValue) => void;
}) {
  const remaining = item ? item.amount - item.spent : 0;
  const barPercent = item ? Math.min(100, Math.max(0, item.percent)) : 0;

  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <div className="relative inline-flex w-full items-center">
        <select
          value={selectedKey ?? "none"}
          onChange={(e) => onChange(e.target.value === "none" ? null : e.target.value)}
          aria-label="Budget slot"
          className="min-h-[36px] w-full appearance-none truncate rounded-md border border-transparent bg-transparent py-1 pl-1 pr-6 text-xs font-medium text-zinc-500 outline-none transition-colors hover:border-black/10 focus:border-black/20 dark:text-zinc-400 dark:hover:border-white/10 dark:focus:border-white/20"
        >
          <option value="none">None</option>
          {items.map((option) => (
            <option key={option.key} value={option.key}>
              {option.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
      </div>

      {item ? (
        <Link
          href="/budget"
          className="mt-1 flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <DonutMeter percent={barPercent} ready size={44} strokeWidth={5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.colour }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
              {item.pace && (
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    item.pace === "atRisk"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  }`}
                >
                  {item.pace === "atRisk" ? (
                    <TriangleAlert className="h-3 w-3" />
                  ) : (
                    <CircleCheck className="h-3 w-3" />
                  )}
                  {item.pace === "atRisk" ? "At risk" : "On track"}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {currencyFormatter.format(item.spent)} of {currencyFormatter.format(item.amount)}
            </p>
            <p
              className={`text-xs font-medium ${
                remaining < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {remaining < 0
                ? `Overspent by ${currencyFormatter.format(Math.abs(remaining))}`
                : `${currencyFormatter.format(remaining)} remaining`}
            </p>
          </div>
        </Link>
      ) : (
        <div className="mt-1 flex h-16 items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
          No budget selected
        </div>
      )}
    </div>
  );
}
