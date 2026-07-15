"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Transaction } from "../../lib/csv";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export type DrillDownData = {
  title: string;
  transactions: Transaction[];
  href: string;
};

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: "480px",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  backgroundColor: "white",
  zIndex: 50,
  boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
};

const headerStyle: CSSProperties = {
  flexShrink: 0,
  padding: "24px",
  borderBottom: "1px solid #e5e7eb",
  backgroundColor: "white",
};

const scrollStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "0 24px",
};

const footerStyle: CSSProperties = {
  flexShrink: 0,
  padding: "16px 24px",
  borderTop: "1px solid #e5e7eb",
  backgroundColor: "white",
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
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle} className="flex items-center justify-between gap-3">
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
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div style={scrollStyle}>
          <div className="py-4">
            <div className="rounded-lg border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr>
                    <th className="px-3 py-2 font-medium text-zinc-500">Date</th>
                    <th className="px-3 py-2 font-medium text-zinc-500">Description</th>
                    <th className="px-3 py-2 font-medium text-zinc-500">Category</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {data.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    data.transactions.map((transaction, index) => (
                      <tr key={transaction.id ?? index}>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                          {transaction.date}
                        </td>
                        <td className="px-3 py-2 font-medium text-zinc-900">
                          {transaction.description}
                        </td>
                        <td className="px-3 py-2 text-zinc-900">{transaction.category}</td>
                        <td
                          className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                            transaction.amount < 0 ? "text-zinc-900" : "text-emerald-600"
                          }`}
                        >
                          {transaction.amount < 0 ? "-" : "+"}
                          {currencyFormatter.format(Math.abs(transaction.amount))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={footerStyle} className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-900">
            Total: {currencyFormatter.format(total)}
          </p>
          <Link
            href={data.href}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            View in Transactions
          </Link>
        </div>
      </div>
    </div>
  );
}
