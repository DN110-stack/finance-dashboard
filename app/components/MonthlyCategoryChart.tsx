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
import { useTransactions } from "../context/TransactionsContext";
import { useCategories } from "../context/CategoriesContext";
import { getCategoryColor, orderByParentPriority, resolveGroupName } from "../lib/categories";
import {
  filterTransactionsByPeriod,
  formatMonthLabel,
  formatPeriodLabel,
  getMonthRange,
  type PeriodState,
} from "../lib/period";
import { buildTransactionsHref, PARENT_FILTER_PREFIX } from "../transactions/TransactionFilters";
import EmptyChartState from "./charts/EmptyChartState";
import DrillDownPanel, { type DrillDownData } from "./charts/DrillDownPanel";

export default function MonthlyCategoryChart({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();
  const { categories: userCategories } = useCategories();
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);

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
        const row: Record<string, string | number> = {
          month: formatMonthLabel(monthKey),
          monthKey,
        };
        for (const category of categories) {
          row[category] = Math.round((totals[category] ?? 0) * 100) / 100;
        }
        return row;
      });

    return { data, categories };
  }, [transactions, userCategories, period]);

  function handleBarClick(category: string, monthKey: string) {
    const range = getMonthRange(monthKey);
    const matches = transactions.filter(
      (t) =>
        !t.isOneOff &&
        t.amount < 0 &&
        t.date >= range.from &&
        t.date <= range.to &&
        resolveGroupName(t.category, userCategories) === category
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
              cursor="pointer"
              onClick={(entry: { payload?: { monthKey: string } }) =>
                entry.payload && handleBarClick(category, entry.payload.monthKey)
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {drillDown && <DrillDownPanel data={drillDown} onClose={() => setDrillDown(null)} />}
    </>
  );
}
