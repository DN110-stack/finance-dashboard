"use client";

import { useMemo } from "react";
import { Landmark, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { useTransactions } from "../context/TransactionsContext";
import { filterTransactionsByPeriod, type PeriodState } from "../lib/period";
import { SummaryCardsSkeleton } from "./Skeleton";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function SummaryCards({ period }: { period: PeriodState }) {
  const { transactions, isLoading } = useTransactions();

  const { savings, monthlyIncome, monthlyExpenses, savingsRate } = useMemo(() => {
    // One-off transactions are excluded from every dashboard calculation —
    // they're still visible/manageable on the Transactions page, just not
    // part of the recurring-spending picture shown here.
    const included = transactions.filter((t) => !t.isOneOff);
    const periodTransactions = filterTransactionsByPeriod(included, period);

    const monthlyIncome = periodTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = periodTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const savings = monthlyIncome - monthlyExpenses;

    const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;

    return { savings, monthlyIncome, monthlyExpenses, savingsRate };
  }, [transactions, period]);

  const cards = [
    {
      label: "Savings",
      value: currencyFormatter.format(savings),
      icon: Landmark,
      iconClass: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    },
    {
      label: "Monthly Income",
      value: currencyFormatter.format(monthlyIncome),
      icon: TrendingUp,
      iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      label: "Monthly Expenses",
      value: currencyFormatter.format(monthlyExpenses),
      icon: TrendingDown,
      iconClass: "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    },
    {
      label: "Savings Rate",
      value: `${Math.round(savingsRate)}%`,
      icon: PiggyBank,
      iconClass: "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
    },
  ];

  if (isLoading) return <SummaryCardsSkeleton />;

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-lg border border-black/10 p-3 transition-shadow hover:shadow-sm sm:gap-4 sm:p-4 dark:border-white/10"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${card.iconClass}`}
            >
              <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
                {card.label}
              </p>
              <p className="mt-1 truncate text-lg font-semibold sm:text-2xl">{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
