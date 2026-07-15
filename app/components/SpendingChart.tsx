"use client";

import { useMemo, useState } from "react";
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
import { filterTransactionsByPeriod, formatPeriodLabel, getPeriodRange, type PeriodState } from "../lib/period";
import { buildTransactionsHref, PARENT_FILTER_PREFIX } from "../transactions/TransactionFilters";
import EmptyChartState from "./charts/EmptyChartState";
import DrillDownPanel, { type DrillDownData } from "./charts/DrillDownPanel";

export default function SpendingChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);

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

  function handleBarClick(category: string) {
    const range = getPeriodRange(period);
    if (!range) return;

    const matches = transactions.filter(
      (t) =>
        !t.isOneOff &&
        t.amount < 0 &&
        t.date >= range.from &&
        t.date <= range.to &&
        resolveGroupName(t.category, categories) === category
    );

    setDrillDown({
      title: `${category} — ${formatPeriodLabel(range)}`,
      transactions: matches,
      href: buildTransactionsHref({
        category: `${PARENT_FILTER_PREFIX}${category}`,
        dateFrom: range.from,
        dateTo: range.to,
      }),
    });
  }

  if (data.length === 0) return <EmptyChartState />;

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
          <XAxis dataKey="category" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
          <Bar
            dataKey="total"
            name="Spending"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(entry: { payload?: { category: string } }) =>
              entry.payload && handleBarClick(entry.payload.category)
            }
          >
            {data.map((entry) => (
              <Cell key={entry.category} fill={getCategoryColor(entry.category, categories).hex} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {drillDown && <DrillDownPanel data={drillDown} onClose={() => setDrillDown(null)} />}
    </>
  );
}
