"use client";

import { useMemo, useSyncExternalStore, type ComponentType } from "react";
import {
  ArrowLeftRight,
  Bell,
  Calculator,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Hash,
  Hourglass,
  Landmark,
  PiggyBank,
  Receipt,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useTransactions } from "../context/TransactionsContext";
import { useSettings } from "../context/SettingsContext";
import {
  filterTransactionsByPeriod,
  getPeriodRange,
  parseISODate,
  toISODate,
  type PeriodState,
} from "../lib/period";
import { computeCurrentBalance } from "../lib/currentBalance";
import { formatDueDate } from "../lib/bills";
import { useBillSchedule } from "../lib/useBillSchedule";
import {
  ALL_SUMMARY_STAT_TYPES,
  summaryLayoutStore,
  type SummaryLayout,
  type SummaryStatType,
} from "../lib/summaryLayout";
import { SummaryCardsSkeleton } from "./Skeleton";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type StatDefinition = {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
};

const STAT_DEFINITIONS: Record<SummaryStatType, StatDefinition> = {
  currentBalance: {
    label: "Current Balance",
    description: "Opening balance plus every transaction since — all time, not period-scoped.",
    icon: Landmark,
    iconClass: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  income: {
    label: "Income",
    description: "Total money in for the selected period.",
    icon: TrendingUp,
    iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  expenses: {
    label: "Expenses",
    description: "Total money out for the selected period.",
    icon: TrendingDown,
    iconClass: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  },
  savingsRate: {
    label: "Savings Rate",
    description: "The percentage of income saved — (income − expenses) ÷ income.",
    icon: PiggyBank,
    iconClass: "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  },
  netCashFlow: {
    label: "Savings Amount",
    description: "How much you saved in the selected period — income minus expenses (negative if you overspent).",
    icon: ArrowLeftRight,
    iconClass: "bg-teal-100 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
  },
  avgDailySpend: {
    label: "Avg Daily Spend",
    description: "Expenses divided by the days elapsed in the selected period.",
    icon: CalendarDays,
    iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
  largestExpense: {
    label: "Largest Expense",
    description: "The single biggest purchase in the selected period.",
    icon: Receipt,
    iconClass: "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  },
  topCategory: {
    label: "Top Spending Category",
    description: "The category you spent the most on in the selected period.",
    icon: Tag,
    iconClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  },
  transactionCount: {
    label: "Transactions",
    description: "How many transactions fall in the selected period.",
    icon: Hash,
    iconClass: "bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  },
  avgExpense: {
    label: "Avg Expense",
    description: "Average size of a single purchase in the selected period.",
    icon: Calculator,
    iconClass: "bg-pink-100 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
  },
  balanceRunway: {
    label: "Balance Runway",
    description: "How many days your current balance lasts at the period's average daily spend.",
    icon: Hourglass,
    iconClass: "bg-lime-100 text-lime-700 dark:bg-lime-500/10 dark:text-lime-400",
  },
  billsRemaining: {
    label: "Bills Remaining",
    description: "Fixed outgoings still to pay this calendar month, from your Bills page.",
    icon: CalendarClock,
    iconClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
  },
  nextBill: {
    label: "Next Bill",
    description: "The next unpaid bill coming due, from your Bills page.",
    icon: Bell,
    iconClass: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-400",
  },
};

// Days from the start of the period up to today (or the period's end, if
// that's earlier) — so a half-finished month averages over days so far.
function daysElapsedInPeriod(period: PeriodState, now: Date = new Date()): number {
  const range = getPeriodRange(period, now);
  if (!range) return 0;

  const end = range.to < toISODate(now) ? range.to : toISODate(now);
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((parseISODate(end).getTime() - parseISODate(range.from).getTime()) / msPerDay) + 1;
  return Math.max(days, 1);
}

export default function SummaryCards({ period }: { period: PeriodState }) {
  const { transactions, isLoading } = useTransactions();
  const { openingBalance, openingBalanceDate } = useSettings();
  const layout = useSyncExternalStore(
    summaryLayoutStore.subscribe,
    summaryLayoutStore.getSnapshot,
    summaryLayoutStore.getServerSnapshot
  );

  // Bills for the rest of this month (including anything already overdue in
  // it) plus the year ahead, so "Next Bill" can look past month-end.
  const now = new Date();
  const today = toISODate(now);
  const monthStart = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const horizon = toISODate(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()));
  const { occurrences: billOccurrences } = useBillSchedule(monthStart, horizon, today);

  const values = useMemo(() => {
    // One-off transactions are excluded from every dashboard calculation —
    // they're still visible/manageable on the Transactions page, just not
    // part of the recurring-spending picture shown here.
    const included = transactions.filter((t) => !t.isOneOff);
    const periodTransactions = filterTransactionsByPeriod(included, period);
    const expenseTransactions = periodTransactions.filter((t) => t.amount < 0);

    const income = periodTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const net = income - expenses;
    const savingsRate = income > 0 ? (net / income) * 100 : 0;

    const days = daysElapsedInPeriod(period);
    const avgDailySpend = days > 0 ? expenses / days : 0;

    const largestExpense = expenseTransactions.reduce<(typeof expenseTransactions)[number] | null>(
      (max, t) => (max === null || Math.abs(t.amount) > Math.abs(max.amount) ? t : max),
      null
    );

    const categoryTotals = new Map<string, number>();
    for (const t of expenseTransactions) {
      categoryTotals.set(t.category, (categoryTotals.get(t.category) ?? 0) + Math.abs(t.amount));
    }
    const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    // Current balance is deliberately all-time and includes one-off
    // transactions — it tracks the real account balance, not a period metric.
    const currentBalance = computeCurrentBalance(transactions, openingBalance, openingBalanceDate);

    const runwayDays =
      currentBalance !== null && currentBalance > 0 && avgDailySpend > 0
        ? Math.floor(currentBalance / avgDailySpend)
        : null;

    const monthBills = billOccurrences.filter((o) => o.dueDate <= monthEnd);
    const unpaidMonthBills = monthBills.filter((o) => o.status !== "paid");
    const billsRemaining = unpaidMonthBills.reduce((sum, o) => sum + o.bill.amount, 0);
    const billsTotal = monthBills.reduce((sum, o) => sum + o.bill.amount, 0);
    const nextBill = billOccurrences.find((o) => o.status !== "paid" && o.dueDate >= today) ?? null;

    const none = "—";
    const record: Record<SummaryStatType, { value: string; detail?: string }> = {
      currentBalance: {
        value: currentBalance === null ? "Set in Settings" : currencyFormatter.format(currentBalance),
      },
      income: { value: currencyFormatter.format(income) },
      expenses: { value: currencyFormatter.format(expenses) },
      savingsRate: { value: `${Math.round(savingsRate)}%` },
      netCashFlow: {
        value: `${net < 0 ? "−" : net > 0 ? "+" : ""}${currencyFormatter.format(Math.abs(net))}`,
      },
      avgDailySpend: { value: days > 0 ? currencyFormatter.format(avgDailySpend) : none },
      largestExpense: {
        value: largestExpense ? currencyFormatter.format(Math.abs(largestExpense.amount)) : none,
        detail: largestExpense?.description,
      },
      topCategory: {
        value: topCategory ? topCategory[0] : none,
        detail: topCategory ? currencyFormatter.format(topCategory[1]) : undefined,
      },
      transactionCount: { value: String(periodTransactions.length) },
      avgExpense: {
        value: expenseTransactions.length > 0
          ? currencyFormatter.format(expenses / expenseTransactions.length)
          : none,
      },
      balanceRunway: {
        value: runwayDays === null ? (currentBalance === null ? "Set in Settings" : none) : `${runwayDays} days`,
      },
      billsRemaining: {
        value: currencyFormatter.format(billsRemaining),
        detail:
          monthBills.length === 0
            ? "No bills this month"
            : `${monthBills.length - unpaidMonthBills.length} of ${monthBills.length} paid · ${currencyFormatter.format(billsTotal)} total`,
      },
      nextBill: nextBill
        ? {
            value: currencyFormatter.format(nextBill.bill.amount),
            detail: `${nextBill.bill.name} · ${formatDueDate(nextBill.dueDate, today)}`,
          }
        : { value: none },
    };
    return record;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- today/monthEnd derive from the same render-time date as billOccurrences
  }, [transactions, period, openingBalance, openingBalanceDate, billOccurrences]);

  function updateSlot(index: number, type: SummaryStatType) {
    const next = [...layout] as SummaryLayout;
    next[index] = type;
    summaryLayoutStore.set(next);
  }

  if (isLoading) return <SummaryCardsSkeleton />;

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {layout.map((type, index) => {
        const definition = STAT_DEFINITIONS[type];
        const Icon = definition.icon;
        const stat = values[type];
        return (
          <div
            key={index}
            className="flex items-center gap-3 rounded-lg border border-black/10 p-3 transition-shadow hover:shadow-sm sm:gap-4 sm:p-4 dark:border-white/10"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${definition.iconClass}`}
            >
              <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative inline-flex max-w-full items-center" title={definition.description}>
                <select
                  value={type}
                  onChange={(e) => updateSlot(index, e.target.value as SummaryStatType)}
                  aria-label="Summary stat"
                  className="-ml-1 max-w-full cursor-pointer appearance-none truncate rounded-md border border-transparent bg-transparent py-0.5 pl-1 pr-5 text-xs text-zinc-500 outline-none transition-colors hover:border-black/10 focus:border-black/20 sm:text-sm dark:text-zinc-400 dark:hover:border-white/10 dark:focus:border-white/20"
                >
                  {ALL_SUMMARY_STAT_TYPES.map((option) => (
                    <option key={option} value={option} className="text-zinc-900">
                      {STAT_DEFINITIONS[option].label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              </div>
              <p className="mt-1 truncate text-lg font-semibold sm:text-2xl">{stat.value}</p>
              {stat.detail && (
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{stat.detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
