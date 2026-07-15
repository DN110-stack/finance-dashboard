"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTransactions } from "../context/TransactionsContext";
import { useCategories } from "../context/CategoriesContext";
import { getCategoryColor, orderByParentPriority, resolveGroupName } from "../lib/categories";
import { filterTransactionsByPeriod, type PeriodState } from "../lib/period";

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export default function MonthlyCategoryChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();
  const { categories: userCategories } = useCategories();

  const { data, categories } = useMemo(() => {
    const periodTransactions = filterTransactionsByPeriod(transactions, period);
    const monthTotals = new Map<string, Record<string, number>>();
    const categorySet = new Set<string>();

    for (const transaction of periodTransactions) {
      if (transaction.amount >= 0 || transaction.isOneOff) continue;

      const monthKey = transaction.date.slice(0, 7);
      const group = resolveGroupName(transaction.category, userCategories);
      categorySet.add(group);

      const totals = monthTotals.get(monthKey) ?? {};
      totals[group] = (totals[group] ?? 0) + Math.abs(transaction.amount);
      monthTotals.set(monthKey, totals);
    }

    const categories = orderByParentPriority(categorySet);

    const data = Array.from(monthTotals.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([monthKey, totals]) => {
        const row: Record<string, string | number> = { month: formatMonthLabel(monthKey) };
        for (const category of categories) {
          row[category] = Math.round((totals[category] ?? 0) * 100) / 100;
        }
        return row;
      });

    return { data, categories };
  }, [transactions, userCategories, period]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {categories.map((category) => (
          <Bar
            key={category}
            dataKey={category}
            name={category}
            fill={getCategoryColor(category, userCategories).hex}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
