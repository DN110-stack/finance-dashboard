"use client";

import { useMemo, useState } from "react";
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
import { useTransactions } from "../../context/TransactionsContext";
import {
  filterTransactionsByPeriod,
  formatMonthLabel,
  formatPeriodLabel,
  getMonthRange,
  type PeriodState,
} from "../../lib/period";
import { buildTransactionsHref } from "../../transactions/TransactionFilters";
import EmptyChartState from "./EmptyChartState";
import DrillDownPanel, { type DrillDownData } from "./DrillDownPanel";

// Validated (dataviz skill categorical-palette checks, light + dark surfaces)
// green/red pair for a status-like income/expense contrast.
const INCOME_COLOR = "#16a34a";
const EXPENSE_COLOR = "#ef4444";

type Series = "Income" | "Expenses";

export default function IncomeVsExpensesChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);

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
        monthKey,
        Income: Math.round(income * 100) / 100,
        Expenses: Math.round(expenses * 100) / 100,
      }));
  }, [transactions, period]);

  function handleBarClick(series: Series, monthKey: string) {
    const range = getMonthRange(monthKey);
    const matches = transactions.filter(
      (t) =>
        !t.isOneOff &&
        t.date >= range.from &&
        t.date <= range.to &&
        (series === "Income" ? t.amount > 0 : t.amount < 0)
    );

    setDrillDown({
      title: `${series} — ${formatPeriodLabel(range)}`,
      transactions: matches,
      href: buildTransactionsHref({
        dateFrom: range.from,
        dateTo: range.to,
        amountMin: series === "Income" ? "0.01" : "",
        amountMax: series === "Expenses" ? "-0.01" : "",
      }),
    });
  }

  if (data.length === 0) return <EmptyChartState />;

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="Income"
            fill={INCOME_COLOR}
            radius={[3, 3, 0, 0]}
            cursor="pointer"
            onClick={(entry: { payload?: { monthKey: string } }) =>
              entry.payload && handleBarClick("Income", entry.payload.monthKey)
            }
          />
          <Bar
            dataKey="Expenses"
            fill={EXPENSE_COLOR}
            radius={[3, 3, 0, 0]}
            cursor="pointer"
            onClick={(entry: { payload?: { monthKey: string } }) =>
              entry.payload && handleBarClick("Expenses", entry.payload.monthKey)
            }
          />
        </BarChart>
      </ResponsiveContainer>

      {drillDown && <DrillDownPanel data={drillDown} onClose={() => setDrillDown(null)} />}
    </>
  );
}
