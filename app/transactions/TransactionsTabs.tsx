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
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-1 sm:overflow-visible sm:border-b sm:border-black/10 sm:px-0 sm:pb-0 sm:dark:border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors sm:min-h-0 sm:-mb-px sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-3 sm:py-2 ${
              activeTab === tab
                ? "border-blue-600 bg-blue-600 text-white sm:border-zinc-900 sm:bg-transparent sm:text-zinc-900 sm:dark:border-white sm:dark:text-white"
                : "border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10 sm:border-transparent sm:text-zinc-500 sm:hover:bg-transparent sm:hover:text-zinc-900 sm:dark:hover:bg-transparent sm:dark:hover:text-white"
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
