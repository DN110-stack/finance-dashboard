"use client";

import { useState } from "react";
import TransactionsTable from "./TransactionsTable";
import UploadHistory from "./UploadHistory";

const TABS = ["Transactions", "Upload History"] as const;
type Tab = (typeof TABS)[number];

export default function TransactionsTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("Transactions");

  return (
    <>
      <div className="mt-4 flex gap-1 border-b border-black/10 dark:border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Transactions" ? <TransactionsTable /> : <UploadHistory />}
    </>
  );
}
