"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import TransactionsTable from "./TransactionsTable";
import UploadHistory from "./UploadHistory";
import CategoriesManager from "./CategoriesManager";

const TABS = ["Transactions", "Upload History", "Categories"] as const;
type Tab = (typeof TABS)[number];

// Only "?tab=categories" is a recognized deep link — anything else (including
// no param at all) falls back to the default "Transactions" tab.
function tabFromSearchParam(value: string | null): Tab {
  return value === "categories" ? "Categories" : "Transactions";
}

export default function TransactionsTabs() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromSearchParam(searchParams.get("tab")));

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

      {activeTab === "Transactions" && <TransactionsTable />}
      {activeTab === "Upload History" && <UploadHistory />}
      {activeTab === "Categories" && <CategoriesManager />}
    </>
  );
}
