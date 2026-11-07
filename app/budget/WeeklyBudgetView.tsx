"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBudgets } from "../context/BudgetsContext";
import { useCategories } from "../context/CategoriesContext";
import { useAnalysisTransactions } from "../lib/useAnalysisTransactions";
import { formatMonthKey, progressBarColour } from "../lib/budgets";
import { getWeekBounds, isMonthApplicable } from "../lib/budgetPeriods";
import { formatPeriodLabel } from "../lib/period";
import { BudgetCardsSkeleton } from "../components/Skeleton";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const DEFAULT_SWATCH_COLOUR = "#71717a";

// A month's budget spread evenly across the year's weeks: monthly × 12 ÷ 52.
function weeklyAmount(monthly: number): number {
  return (monthly * 12) / 52;
}

type WeeklyItem = {
  key: string;
  name: string;
  colour: string;
  categories: string[]; // lower-cased names the item covers
  weekly: number;
  spent: number;
};

// Your monthly budgets as weekly allowances, against what you've actually
// spent in the chosen Monday–Sunday week.
export default function WeeklyBudgetView() {
  const { budgets, budgetGroups, isLoading: budgetsLoading } = useBudgets();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { transactions } = useAnalysisTransactions({ respectOneOffToggle: false });

  const [weekOffset, setWeekOffset] = useState(0);

  const week = useMemo(() => {
    const now = new Date();
    return getWeekBounds(new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7));
  }, [weekOffset]);

  // The month a week "belongs" to for picking budgets is the month of its Monday.
  const monthKey = useMemo(() => {
    const [year, month, day] = week.from.split("-").map(Number);
    return formatMonthKey(new Date(year, month - 1, day));
  }, [week]);

  const items = useMemo<WeeklyItem[]>(() => {
    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

    const spentByCategory = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount >= 0 || t.isOneOff) continue;
      if (t.date < week.from || t.date > week.to) continue;
      const key = t.category.toLowerCase();
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Math.abs(t.amount));
    }
    const spentFor = (names: string[]) => names.reduce((sum, name) => sum + (spentByCategory.get(name) ?? 0), 0);

    const list: WeeklyItem[] = [];

    for (const b of budgets) {
      if (!isMonthApplicable(b.month, b.periodType, monthKey)) continue;
      const names = [b.category.toLowerCase()];
      list.push({
        key: `single:${b.id}`,
        name: b.category,
        colour: categoryByName.get(names[0])?.colour ?? DEFAULT_SWATCH_COLOUR,
        categories: names,
        weekly: weeklyAmount(b.amount),
        spent: spentFor(names),
      });
    }

    for (const g of budgetGroups) {
      if (g.month !== monthKey) continue;
      const names = g.categories.map((name) => name.toLowerCase());
      const swatch = names.map((name) => categoryByName.get(name)).find(Boolean);
      list.push({
        key: `group:${g.id}`,
        name: g.name,
        colour: swatch?.colour ?? DEFAULT_SWATCH_COLOUR,
        categories: names,
        weekly: weeklyAmount(g.amount),
        spent: spentFor(names),
      });
    }

    return list.sort((a, b) => b.weekly - a.weekly);
  }, [budgets, budgetGroups, categories, transactions, week, monthKey]);

  const totalWeekly = items.reduce((sum, item) => sum + item.weekly, 0);
  const totalSpent = items.reduce((sum, item) => sum + item.spent, 0);

  if (budgetsLoading || categoriesLoading) return <BudgetCardsSkeleton count={4} />;

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setWeekOffset((offset) => offset - 1)}
          aria-label="Previous week"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">{weekOffset === 0 ? "This week" : formatPeriodLabel(week)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatPeriodLabel(week)} · Mon–Sun
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWeekOffset((offset) => offset + 1)}
          aria-label="Next week"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          No budgets apply to this week. Add some on the Monthly tab and they&apos;ll show here as weekly
          amounts.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-lg border border-black/10 p-3 sm:p-4 dark:border-white/10">
              <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">Weekly allowance</p>
              <p className="mt-1 text-lg font-semibold sm:text-2xl">{currencyFormatter.format(totalWeekly)}</p>
            </div>
            <div className="rounded-lg border border-black/10 p-3 sm:p-4 dark:border-white/10">
              <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">Spent this week</p>
              <p className="mt-1 text-lg font-semibold sm:text-2xl">{currencyFormatter.format(totalSpent)}</p>
            </div>
          </div>

          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {items.map((item) => {
              const percent = item.weekly > 0 ? (item.spent / item.weekly) * 100 : 0;
              const remaining = item.weekly - item.spent;
              return (
                <li key={item.key} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.colour }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                    <span className="shrink-0 text-sm font-semibold">
                      {currencyFormatter.format(item.weekly)}
                      <span className="font-normal text-zinc-500 dark:text-zinc-400"> / week</span>
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full ${progressBarColour(percent)}`}
                      style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {currencyFormatter.format(item.spent)} spent
                    </span>
                    <span
                      className={`font-medium ${
                        remaining < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {remaining < 0
                        ? `Over by ${currencyFormatter.format(Math.abs(remaining))}`
                        : `${currencyFormatter.format(remaining)} left`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
