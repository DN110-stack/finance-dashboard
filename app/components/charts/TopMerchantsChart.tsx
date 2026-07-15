"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTransactions } from "../../context/TransactionsContext";
import { filterTransactionsByPeriod, type PeriodState } from "../../lib/period";
import { extractKeyword } from "../../lib/rules";
import EmptyChartState from "./EmptyChartState";

const BAR_COLOR = "#2a78d6";

export default function TopMerchantsChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();

  const data = useMemo(() => {
    const periodTransactions = filterTransactionsByPeriod(
      transactions.filter((t) => !t.isOneOff),
      period
    );

    // Groups by the same short keyword used for rule-matching, so repeat
    // visits to the same merchant (with different reference numbers in the
    // description) roll up into one entry instead of scattering.
    const totals = new Map<string, number>();
    for (const transaction of periodTransactions) {
      if (transaction.amount >= 0) continue;
      const merchant = extractKeyword(transaction.description) || transaction.description;
      totals.set(merchant, (totals.get(merchant) ?? 0) + Math.abs(transaction.amount));
    }

    return Array.from(totals.entries())
      .map(([merchant, total]) => ({ merchant, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [transactions, period]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="merchant" tick={{ fontSize: 12 }} width={100} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Bar dataKey="total" name="Spend" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
