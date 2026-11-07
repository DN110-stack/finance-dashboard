"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useCategories } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import type { Transaction } from "./csv";
import { excludeOneOffsStore } from "./analysisSettings";
import { transferCategoryNames } from "./categoryKind";

// The transactions every dashboard calculation should work from: transfers
// (moves between your own accounts, card payments) are always left out, since
// they're neither income nor spending.
//
// One-offs: every calculation already skips transactions with isOneOff set.
// When the dashboard's "Exclude one-offs" toggle is off, they're handed back
// with the flag cleared so they flow through those same calculations — which
// keeps this a drop-in replacement for useTransactions() in all of them.
// Budget screens pass respectOneOffToggle: false, since the toggle lives on
// the dashboard and shouldn't silently change what a budget says you've spent.
export function useAnalysisTransactions({
  respectOneOffToggle = true,
}: { respectOneOffToggle?: boolean } = {}): {
  transactions: Transaction[];
  isLoading: boolean;
} {
  const { transactions, isLoading: transactionsLoading } = useTransactions();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const excludeOneOffs = useSyncExternalStore(
    excludeOneOffsStore.subscribe,
    excludeOneOffsStore.getSnapshot,
    excludeOneOffsStore.getServerSnapshot
  );

  const filtered = useMemo(() => {
    const transfers = transferCategoryNames(categories);
    const includeOneOffs = respectOneOffToggle && !excludeOneOffs;

    return transactions
      .filter((t) => !transfers.has(t.category.toLowerCase()))
      .map((t) => (includeOneOffs && t.isOneOff ? { ...t, isOneOff: false } : t));
  }, [transactions, categories, excludeOneOffs, respectOneOffToggle]);

  return { transactions: filtered, isLoading: transactionsLoading || categoriesLoading };
}
