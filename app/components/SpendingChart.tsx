"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTransactions } from "../context/TransactionsContext";
import { useCategories } from "../context/CategoriesContext";
import { getCategoryColor, orderByParentPriority, resolveGroupName } from "../lib/categories";
import { filterTransactionsByPeriod, type PeriodState } from "../lib/period";

export default function SpendingChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();
  const { categories } = useCategories();

  const data = useMemo(() => {
    const periodTransactions = filterTransactionsByPeriod(transactions, period);
    const totals = new Map<string, number>();

    for (const transaction of periodTransactions) {
      if (transaction.amount >= 0 || transaction.isOneOff) continue;
      const group = resolveGroupName(transaction.category, categories);
      totals.set(group, (totals.get(group) ?? 0) + Math.abs(transaction.amount));
    }

    const order = orderByParentPriority(totals.keys());
    return order.map((category) => ({
      category,
      total: Math.round((totals.get(category) ?? 0) * 100) / 100,
    }));
  }, [transactions, categories, period]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Bar dataKey="total" name="Spending" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.category} fill={getCategoryColor(entry.category, categories).hex} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
