import type { ComponentType } from "react";
import type { PeriodState } from "../../lib/period";
import type { ChartType } from "../../lib/chartLayout";
import SpendingChart from "../SpendingChart";
import MonthlyCategoryChart from "../MonthlyCategoryChart";
import IncomeVsExpensesChart from "./IncomeVsExpensesChart";
import SavingsRateTrendChart from "./SavingsRateTrendChart";
import TopMerchantsChart from "./TopMerchantsChart";
import CashFlowChart from "./CashFlowChart";
import DailySpendingHeatmap from "./DailySpendingHeatmap";

export type ChartComponent = ComponentType<{ period: PeriodState }>;

export const CHART_DEFINITIONS: Record<
  ChartType,
  { label: string; description: string; component: ChartComponent }
> = {
  spendingByCategory: {
    label: "Spending by Category",
    description: "Total spending for the selected period, broken down by category.",
    component: SpendingChart,
  },
  monthlyCategoryBreakdown: {
    label: "Monthly Expenses by Category",
    description: "Each month's spending in the selected period, broken down by category.",
    component: MonthlyCategoryChart,
  },
  incomeVsExpenses: {
    label: "Income vs Expenses",
    description: "Total income and expenses for each month in the selected period, side by side.",
    component: IncomeVsExpensesChart,
  },
  savingsRateTrend: {
    label: "Savings Rate Trend",
    description: "The percentage of income saved each month — (income − expenses) ÷ income.",
    component: SavingsRateTrendChart,
  },
  topMerchants: {
    label: "Top 10 Spending Merchants",
    description: "The 10 merchants you spent the most with in the selected period.",
    component: TopMerchantsChart,
  },
  cashFlow: {
    label: "Cash Flow",
    description: "Running balance (income minus expenses) day by day across the selected period.",
    component: CashFlowChart,
  },
  dailyHeatmap: {
    label: "Daily Spending Heatmap",
    description: "A calendar view of each day's spending — darker means more was spent that day.",
    component: DailySpendingHeatmap,
  },
};
