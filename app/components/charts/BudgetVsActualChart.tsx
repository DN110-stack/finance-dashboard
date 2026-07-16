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
import { useBudgets } from "../../context/BudgetsContext";
import { useTransactions } from "../../context/TransactionsContext";
import { orderByParentPriority } from "../../lib/categories";
import { filterTransactionsByPeriod, getPeriodRange, type PeriodState } from "../../lib/period";
import { isMonthApplicable } from "../../lib/budgetPeriods";
import EmptyChartState from "./EmptyChartState";

// Validated (dataviz skill categorical-palette checks, light + dark surfaces)
// blue/orange pair — these two bars are the "Budgeted" vs "Actual" measures,
// not category identity, so they get a fixed 2-colour assignment rather than
// the per-category palette used elsewhere.
const BUDGET_COLOR = "#2a78d6";
const ACTUAL_COLOR = "#eb6834";

// Every "YYYY-MM" key that overlaps the [from, to] range, inclusive.
function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.slice(0, 7).split("-").map(Number);
  const [toYear, toMonth] = to.slice(0, 7).split("-").map(Number);

  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

export default function BudgetVsActualChart({ period }: { period: PeriodState }) {
  const { budgets } = useBudgets();
  const { transactions } = useTransactions();

  const data = useMemo(() => {
    const range = getPeriodRange(period);
    if (!range) return [];

    const months = monthsInRange(range.from, range.to);

    // `budget.amount` is always the monthly-equivalent (raw for plain
    // monthly rows, prorated from period_amount for recurring ones — see
    // budgetPeriods.ts), so a budget just needs counting once per month in
    // range that it's applicable to. For a plain monthly budget this is
    // exactly the old "budget.month === m" behavior; a quarterly budget
    // instead contributes in the ~2 of every 6 months it actually recurs in.
    const budgetTotals = new Map<string, number>();
    for (const budget of budgets) {
      for (const m of months) {
        if (!isMonthApplicable(budget.month, budget.periodType, m)) continue;
        budgetTotals.set(budget.category, (budgetTotals.get(budget.category) ?? 0) + budget.amount);
      }
    }

    const periodTransactions = filterTransactionsByPeriod(
      transactions.filter((t) => !t.isOneOff),
      period
    );
    const actualTotals = new Map<string, number>();
    for (const transaction of periodTransactions) {
      if (transaction.amount >= 0) continue;
      actualTotals.set(
        transaction.category,
        (actualTotals.get(transaction.category) ?? 0) + Math.abs(transaction.amount)
      );
    }

    const order = orderByParentPriority(
      new Set([...budgetTotals.keys(), ...actualTotals.keys()])
    );

    return order.map((category) => ({
      category,
      Budgeted: Math.round((budgetTotals.get(category) ?? 0) * 100) / 100,
      Actual: Math.round((actualTotals.get(category) ?? 0) * 100) / 100,
    }));
  }, [budgets, transactions, period]);

  if (data.length === 0) return <EmptyChartState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-black/10 dark:stroke-white/10" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={100} />
        <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Budgeted" fill={BUDGET_COLOR} radius={[0, 4, 4, 0]} />
        <Bar dataKey="Actual" fill={ACTUAL_COLOR} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
