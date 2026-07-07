"use client";

import { useMemo } from "react";
import { Landmark, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { useTransactions } from "../context/TransactionsContext";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function SummaryCards() {
  const { transactions } = useTransactions();

  const { totalBalance, monthlyIncome, monthlyExpenses, savingsRate } = useMemo(() => {
    const totalBalance = transactions.reduce((sum, t) => sum + t.amount, 0);

    const latestMonth = transactions.reduce<string | null>((latest, t) => {
      const month = t.date.slice(0, 7);
      return !latest || month > latest ? month : latest;
    }, null);

    const monthlyTransactions = latestMonth
      ? transactions.filter((t) => t.date.slice(0, 7) === latestMonth)
      : [];

    const monthlyIncome = monthlyTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const savingsRate = monthlyIncome > 0
      ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100
      : 0;

    return { totalBalance, monthlyIncome, monthlyExpenses, savingsRate };
  }, [transactions]);

  const cards = [
    {
      label: "Total Balance",
      value: currencyFormatter.format(totalBalance),
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

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-lg border border-black/10 p-4 transition-shadow hover:shadow-sm dark:border-white/10"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
