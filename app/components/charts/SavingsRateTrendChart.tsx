"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTransactions } from "../../context/TransactionsContext";
import { filterTransactionsByPeriod, formatMonthLabel, type PeriodState } from "../../lib/period";
import EmptyChartState from "./EmptyChartState";

// Sequential single hue (dataviz skill default "blue"), reused across all
// trend/magnitude charts in this dashboard.
const LINE_COLOR = "#2a78d6";

export default function SavingsRateTrendChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();

  const data = useMemo(() => {
    const periodTransactions = filterTransactionsByPeriod(
      transactions.filter((t) => !t.isOneOff),
      period
    );

    const totals = new Map<string, { income: number; expenses: number }>();
    for (const transaction of periodTransactions) {
      const monthKey = transaction.date.slice(0, 7);
      const entry = totals.get(monthKey) ?? { income: 0, expenses: 0 };
      if (transaction.amount > 0) entry.income += transaction.amount;
      else entry.expenses += Math.abs(transaction.amount);
      totals.set(monthKey, entry);
    }

    return Array.from(totals.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([monthKey, { income, expenses }]) => ({
        month: formatMonthLabel(monthKey),
        rate:
          income > 0 ? Math.round(((income - expenses) / income) * 1000) / 10 : 0,
      }));
  }, [transactions, period]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit="%" />
        <Tooltip formatter={(value) => `${value}%`} />
        <ReferenceLine y={0} className="stroke-black/20 dark:stroke-white/20" />
        <Line
          type="monotone"
          dataKey="rate"
          name="Savings rate"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
