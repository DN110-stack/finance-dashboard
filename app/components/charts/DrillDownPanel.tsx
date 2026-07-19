"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { Transaction } from "../../lib/csv";
import { parseISODate } from "../../lib/period";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// "02 Jul" — matches the compact date format used on the mobile transaction
// cards (see TransactionCard.tsx).
function formatShortDate(iso: string): string {
  const date = parseISODate(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${day} ${month}`;
}

export type DrillDownData = {
  title: string;
  transactions: Transaction[];
  href: string;
};

export default function DrillDownPanel({
  data,
  onClose,
}: {
  data: DrillDownData;
  onClose: () => void;
}) {
  const total = data.transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-0 z-50 flex flex-col bg-white pb-[env(safe-area-inset-bottom)] sm:inset-y-0 sm:top-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-screen sm:w-[480px] sm:pb-0 sm:shadow-[-4px_0_24px_rgba(0,0,0,0.12)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{data.title}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {data.transactions.length} transaction{data.transactions.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="flex flex-col gap-2 py-4">
            {data.transactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No transactions found.</p>
            ) : (
              data.transactions.map((transaction, index) => {
                const key = String(transaction.id ?? index);
                return (
                  <div key={key} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs text-zinc-500">
                        {formatShortDate(transaction.date)}
                      </span>
                      <div className="min-w-2 flex-1" />
                      <span
                        className={`shrink-0 text-sm font-medium whitespace-nowrap ${
                          transaction.amount < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {transaction.amount < 0 ? "-" : "+"}
                        {currencyFormatter.format(Math.abs(transaction.amount))}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-700">{transaction.description}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 bg-white p-4 sm:px-6 sm:py-4">
          <p className="text-sm font-semibold text-zinc-900">
            Total: {currencyFormatter.format(total)}
          </p>
          <Link
            href={data.href}
            className="flex min-h-[44px] items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            View in Transactions
          </Link>
        </div>
      </div>
    </div>
  );
}
