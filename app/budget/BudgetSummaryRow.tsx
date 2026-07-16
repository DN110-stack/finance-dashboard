import { CircleCheck, TriangleAlert } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Shared by BudgetManager and AnnualBudgetManager — three stat cards side by
// side, with the third (Remaining) carrying a status color + icon so
// over/under budget reads at a glance without relying on color alone.
export default function BudgetSummaryRow({ budgeted, spent }: { budgeted: number; spent: number }) {
  const remaining = budgeted - spent;
  const isOverBudget = remaining < 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Budgeted</p>
        <p className="mt-1 text-2xl font-semibold">{currencyFormatter.format(budgeted)}</p>
      </div>

      <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Spent</p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            budgeted > 0 && spent > budgeted ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {currencyFormatter.format(spent)}
        </p>
      </div>

      <div
        className={`rounded-xl border p-4 ${
          isOverBudget
            ? "border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Remaining</p>
          {isOverBudget ? (
            <TriangleAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          ) : (
            <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <p
          className={`mt-1 text-2xl font-semibold ${
            isOverBudget ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {currencyFormatter.format(Math.abs(remaining))}
          {isOverBudget && <span className="ml-1 text-sm font-medium">over</span>}
        </p>
      </div>
    </div>
  );
}
