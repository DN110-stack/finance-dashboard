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
import { getCategoryColor } from "../lib/categories";

export default function SpendingChart() {
  const { transactions } = useTransactions();

  const data = useMemo(() => {
    const totals = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.amount >= 0) continue;
      totals.set(
        transaction.category,
        (totals.get(transaction.category) ?? 0) + Math.abs(transaction.amount)
      );
    }

    return Array.from(totals, ([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
    })).sort((a, b) => b.total - a.total);
  }, [transactions]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Bar dataKey="total" name="Spending" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.category} fill={getCategoryColor(entry.category).hex} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
