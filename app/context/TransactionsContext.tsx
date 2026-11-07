"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankFormat, Transaction } from "../lib/csv";
import { createClient } from "../lib/supabase/client";
import type { Category } from "./CategoriesContext";
import { createRuleMatcher, UNCATEGORIZED } from "../lib/rules";
import { RULE_COLUMNS, ruleFromRow } from "../lib/rulesApi";
import { onCategoryNameReplaced, replaceCategoryName } from "../lib/categoryEvents";

export type UploadBatch = {
  id: string;
  sourceBank: BankFormat;
  fileName: string | null;
  transactionCount: number;
  skippedCount: number;
  createdAt: string;
};

type AddTransactionsResult = {
  inserted: Transaction[];
  skippedCount: number;
};

type TransactionsContextValue = {
  transactions: Transaction[];
  batches: UploadBatch[];
  isLoading: boolean;
  addTransactions: (
    transactions: Transaction[],
    sourceBank: BankFormat,
    fileName: string
  ) => Promise<AddTransactionsResult>;
  assignCategory: (transaction: Transaction, category: Category) => Promise<void>;
  assignCategories: (
    assignments: { transaction: Transaction; category: Category }[]
  ) => Promise<void>;
  applyCategoryChanges: (changes: { id: string; category: string }[]) => Promise<void>;
  deleteBatch: (batchId: string) => Promise<void>;
  deleteTransactions: (transactionIds: string[]) => Promise<void>;
  setTransactionOneOff: (transactionId: string, isOneOff: boolean) => Promise<void>;
};

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

function sortByDate(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function duplicateKey(t: { date: string; description: string; amount: number }) {
  return `${t.date}|${t.description.trim().toLowerCase()}|${t.amount}`;
}

async function fetchTransactions(supabase: SupabaseClient, userId: string) {
  console.log(
    "[TransactionsContext] querying transactions: from('transactions').select('id, date, description, category, amount').eq('user_id', %s).order('date', { ascending: true })",
    userId
  );

  const { data, error, status, statusText } = await supabase
    .from("transactions")
    .select("id, date, description, category, amount, source_bank, is_one_off, category_locked")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  console.log("[TransactionsContext] transactions response:", {
    status,
    statusText,
    error,
    rowCount: data?.length ?? 0,
    data,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    sourceBank: row.source_bank ?? undefined,
    isOneOff: row.is_one_off ?? false,
    categoryLocked: row.category_locked ?? false,
  }));
}

async function fetchBatches(supabase: SupabaseClient, userId: string): Promise<UploadBatch[]> {
  const { data, error } = await supabase
    .from("upload_batches")
    .select("id, source_bank, file_name, transaction_count, skipped_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    sourceBank: row.source_bank,
    fileName: row.file_name,
    transactionCount: row.transaction_count,
    skippedCount: row.skipped_count,
    createdAt: row.created_at,
  }));
}

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Keep in-memory transactions in step with a category rename/move that the
  // database has already applied (see lib/categoryEvents.ts).
  useEffect(
    () =>
      onCategoryNameReplaced((oldName, newName) => {
        setTransactions((prev) =>
          prev.map((t) => ({ ...t, category: replaceCategoryName(t.category, oldName, newName) }))
        );
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log("[TransactionsContext] current user after login:", {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        userError,
      });

      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // Fetched independently — a failure loading batches shouldn't blank
      // out transactions that loaded fine, or vice versa.
      try {
        const loadedTransactions = await fetchTransactions(supabase, user.id);
        if (!cancelled) setTransactions(loadedTransactions);
      } catch (err) {
        console.error("[TransactionsContext] failed to load transactions:", err);
        // Leave transactions empty rather than crash.
      }

      try {
        const loadedBatches = await fetchBatches(supabase, user.id);
        if (!cancelled) setBatches(loadedBatches);
      } catch (err) {
        console.error("[TransactionsContext] failed to load batches:", err);
        // Leave batches empty rather than crash.
      }

      if (!cancelled) setIsLoading(false);
    }

    // A hard navigation/reload while this is in flight aborts the underlying
    // fetch; without a rejection handler that surfaces as an unhandled
    // promise rejection in the console even though `cancelled` already
    // guards against any resulting state update.
    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  async function addTransactions(
    newTransactions: Transaction[],
    sourceBank: BankFormat,
    fileName: string
  ): Promise<AddTransactionsResult> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to upload transactions");
    }

    // Skip anything that already exists (same date + description + amount),
    // and anything duplicated within this same file.
    const dates = Array.from(new Set(newTransactions.map((t) => t.date)));
    const { data: existingRows, error: existingError } = await supabase
      .from("transactions")
      .select("date, description, amount")
      .eq("user_id", user.id)
      .in("date", dates);

    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set((existingRows ?? []).map(duplicateKey));
    const seenInThisUpload = new Set<string>();
    const genuinelyNew: Transaction[] = [];
    let skippedCount = 0;

    for (const transaction of newTransactions) {
      const key = duplicateKey(transaction);
      if (existingKeys.has(key) || seenInThisUpload.has(key)) {
        skippedCount++;
        continue;
      }
      seenInThisUpload.add(key);
      genuinelyNew.push(transaction);
    }

    // The first matching enabled rule by priority wins; anything no rule
    // matches stays Uncategorized for review.
    const { data: ruleRows, error: rulesError } = await supabase
      .from("transaction_rules")
      .select(RULE_COLUMNS)
      .eq("user_id", user.id);

    if (rulesError) throw new Error(rulesError.message);

    const matcher = createRuleMatcher(
      (ruleRows ?? []).map((row) => ruleFromRow(row as unknown as Parameters<typeof ruleFromRow>[0]))
    );

    const categorized = genuinelyNew.map((transaction) => ({
      ...transaction,
      category: matcher.findRule(transaction.description, transaction.amount)?.categoryName ?? UNCATEGORIZED,
    }));

    const { data: batchRow, error: batchError } = await supabase
      .from("upload_batches")
      .insert({
        user_id: user.id,
        source_bank: sourceBank,
        file_name: fileName,
        transaction_count: categorized.length,
        skipped_count: skippedCount,
      })
      .select("id, source_bank, file_name, transaction_count, skipped_count, created_at")
      .single();

    if (batchError) throw new Error(batchError.message);

    const newBatch: UploadBatch = {
      id: batchRow.id,
      sourceBank: batchRow.source_bank,
      fileName: batchRow.file_name,
      transactionCount: batchRow.transaction_count,
      skippedCount: batchRow.skipped_count,
      createdAt: batchRow.created_at,
    };
    setBatches((prev) => [newBatch, ...prev]);

    if (categorized.length === 0) {
      return { inserted: [], skippedCount };
    }

    const rows = categorized.map((transaction) => ({
      user_id: user.id,
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      amount: transaction.amount,
      source_bank: sourceBank,
      batch_id: newBatch.id,
    }));

    const { data: inserted, error } = await supabase.from("transactions").insert(rows).select();
    if (error) throw new Error(error.message);

    const insertedTransactions: Transaction[] = inserted.map((row) => ({
      id: row.id,
      date: row.date,
      description: row.description,
      category: row.category,
      amount: Number(row.amount),
      sourceBank: row.source_bank ?? undefined,
      isOneOff: row.is_one_off ?? false,
      categoryLocked: row.category_locked ?? false,
    }));

    setTransactions((prev) => sortByDate([...prev, ...insertedTransactions]));
    return { inserted: insertedTransactions, skippedCount };
  }

  async function assignCategory(transaction: Transaction, category: Category) {
    if (!transaction.id) {
      throw new Error("This transaction can't be updated");
    }

    if (transaction.category === category.name) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to categorize transactions");
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({ category: category.name, category_locked: true })
      .eq("id", transaction.id);

    if (updateError) throw new Error(updateError.message);

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transaction.id ? { ...t, category: category.name, categoryLocked: true } : t
      )
    );
  }

  // Bulk version of assignCategory — used to accept many AI suggestions at
  // once without one round trip per transaction. Groups the work by target
  // category instead so cost scales with the number of distinct categories
  // involved, not the number of transactions.
  async function assignCategories(
    assignments: { transaction: Transaction; category: Category }[]
  ) {
    const valid = assignments.filter(
      (a) => a.transaction.id && a.transaction.category !== a.category.name
    );
    if (valid.length === 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to categorize transactions");
    }

    const idsByCategory = new Map<string, { name: string; ids: string[] }>();
    for (const { transaction, category } of valid) {
      const entry = idsByCategory.get(category.id);
      if (entry) entry.ids.push(transaction.id!);
      else idsByCategory.set(category.id, { name: category.name, ids: [transaction.id!] });
    }

    for (const { name, ids } of idsByCategory.values()) {
      const { error } = await supabase
        .from("transactions")
        .update({ category: name, category_locked: true })
        .in("id", ids)
        .eq("user_id", user.id);

      if (error) throw new Error(error.message);
    }

    const categoryNameById = new Map(
      valid.map(({ transaction, category }) => [transaction.id!, category.name])
    );
    setTransactions((prev) =>
      prev.map((t) =>
        t.id && categoryNameById.has(t.id)
          ? { ...t, category: categoryNameById.get(t.id)!, categoryLocked: true }
          : t
      )
    );
  }

  // Sets categories from rules in bulk. Unlike assignCategory this does NOT
  // mark the category as set by hand, so a later rule change can still move it.
  async function applyCategoryChanges(changes: { id: string; category: string }[]) {
    if (changes.length === 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to categorize transactions");
    }

    const idsByCategory = new Map<string, string[]>();
    for (const { id, category } of changes) {
      const ids = idsByCategory.get(category) ?? [];
      ids.push(id);
      idsByCategory.set(category, ids);
    }

    const CHUNK_SIZE = 100;
    for (const [category, ids] of idsByCategory.entries()) {
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const { error } = await supabase
          .from("transactions")
          .update({ category })
          .in("id", ids.slice(i, i + CHUNK_SIZE))
          .eq("user_id", user.id);

        if (error) throw new Error(error.message);
      }
    }

    const categoryById = new Map(changes.map((c) => [c.id, c.category]));
    setTransactions((prev) =>
      prev.map((t) => (t.id && categoryById.has(t.id) ? { ...t, category: categoryById.get(t.id)! } : t))
    );
  }

  async function deleteBatch(batchId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to delete an upload");
    }

    const { error } = await supabase.from("upload_batches").delete().eq("id", batchId);
    if (error) throw new Error(error.message);

    // The DB cascades the delete to every transaction in the batch — resync
    // local state from Supabase rather than trying to track batch_id
    // per-transaction on the client.
    const refreshedTransactions = await fetchTransactions(supabase, user.id);
    setTransactions(refreshedTransactions);
    setBatches((prev) => prev.filter((batch) => batch.id !== batchId));
  }

  async function deleteTransactions(transactionIds: string[]) {
    if (transactionIds.length === 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to delete transactions");
    }

    const { data: deletedRows, error } = await supabase
      .from("transactions")
      .delete()
      .in("id", transactionIds)
      .eq("user_id", user.id)
      .select("batch_id");

    if (error) throw new Error(error.message);

    const deletedIdSet = new Set(transactionIds);
    setTransactions((prev) => prev.filter((t) => !t.id || !deletedIdSet.has(t.id)));

    // Recompute affected batches' transaction_count from what's actually left
    // in the DB, rather than doing arithmetic subtraction — avoids drift if
    // counts were ever out of sync.
    const affectedBatchIds = Array.from(
      new Set((deletedRows ?? []).map((row) => row.batch_id).filter((id): id is string => !!id))
    );

    if (affectedBatchIds.length > 0) {
      for (const batchId of affectedBatchIds) {
        const { count, error: countError } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("batch_id", batchId);

        if (countError) throw new Error(countError.message);

        const { error: updateError } = await supabase
          .from("upload_batches")
          .update({ transaction_count: count ?? 0 })
          .eq("id", batchId);

        if (updateError) throw new Error(updateError.message);
      }

      const refreshedBatches = await fetchBatches(supabase, user.id);
      setBatches(refreshedBatches);
    }
  }

  async function setTransactionOneOff(transactionId: string, isOneOff: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ is_one_off: isOneOff })
      .eq("id", transactionId);

    if (error) throw new Error(error.message);

    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, isOneOff } : t))
    );
  }

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        batches,
        isLoading,
        addTransactions,
        assignCategory,
        assignCategories,
        applyCategoryChanges,
        deleteBatch,
        deleteTransactions,
        setTransactionOneOff,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error("useTransactions must be used within a TransactionsProvider");
  }
  return context;
}
