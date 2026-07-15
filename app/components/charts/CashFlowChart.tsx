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
import {
  filterTransactionsByPeriod,
  getPeriodRange,
  parseISODate,
  toISODate,
  type PeriodState,
} from "../../lib/period";
import EmptyChartState from "./EmptyChartState";

const LINE_COLOR = "#2a78d6";

function formatDateLabel(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CashFlowChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();

  const data = useMemo(() => {
    const range = getPeriodRange(period);
    if (!range) return [];

    const periodTransactions = filterTransactionsByPeriod(
      transactions.filter((t) => !t.isOneOff),
      period
    );
    if (periodTransactions.length === 0) return [];

    const byDay = new Map<string, number>();
    for (const transaction of periodTransactions) {
      byDay.set(transaction.date, (byDay.get(transaction.date) ?? 0) + transaction.amount);
    }

    // Walk every day in the period (not just days with transactions) so the
    // line stays flat between transactions instead of misleadingly
    // connecting distant dates.
    const rows: { date: string; balance: number }[] = [];
    let running = 0;
    const cursor = parseISODate(range.from);
    const end = parseISODate(range.to);
    while (cursor <= end) {
      const iso = toISODate(cursor);
      running += byDay.get(iso) ?? 0;
      rows.push({ date: formatDateLabel(iso), balance: Math.round(running * 100) / 100 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }, [transactions, period]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <ReferenceLine y={0} className="stroke-black/20 dark:stroke-white/20" />
        <Line
          type="monotone"
          dataKey="balance"
          name="Running balance"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
