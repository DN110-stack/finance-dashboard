"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankFormat, Transaction } from "../lib/csv";
import { createClient } from "../lib/supabase/client";
import type { Category } from "./CategoriesContext";
import { extractKeyword, matchCategoryForDescription, UNCATEGORIZED } from "../lib/rules";

export type UploadBatch = {
  id: string;
  sourceBank: BankFormat;
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
    sourceBank: BankFormat
  ) => Promise<AddTransactionsResult>;
  assignCategory: (transaction: Transaction, category: Category) => Promise<void>;
  deleteBatch: (batchId: string) => Promise<void>;
};

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

function sortByDate(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function duplicateKey(t: { date: string; description: string; amount: number }) {
  return `${t.date}|${t.description.trim().toLowerCase()}|${t.amount}`;
}

async function fetchTransactions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, date, description, category, amount")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
  }));
}

async function fetchBatches(supabase: SupabaseClient, userId: string): Promise<UploadBatch[]> {
  const { data, error } = await supabase
    .from("upload_batches")
    .select("id, source_bank, transaction_count, skipped_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    sourceBank: row.source_bank,
    transactionCount: row.transaction_count,
    skippedCount: row.skipped_count,
    createdAt: row.created_at,
  }));
}

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // Fetched independently — a failure loading batches shouldn't blank
      // out transactions that loaded fine, or vice versa.
      try {
        const loadedTransactions = await fetchTransactions(supabase, user.id);
        if (!cancelled) setTransactions(loadedTransactions);
      } catch {
        // Leave transactions empty rather than crash.
      }

      try {
        const loadedBatches = await fetchBatches(supabase, user.id);
        if (!cancelled) setBatches(loadedBatches);
      } catch {
        // Leave batches empty rather than crash.
      }

      if (!cancelled) setIsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function addTransactions(
    newTransactions: Transaction[],
    sourceBank: BankFormat
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

    const { data: rules, error: rulesError } = await supabase
      .from("transaction_rules")
      .select("keyword, categories(name)")
      .eq("user_id", user.id);

    if (rulesError) throw new Error(rulesError.message);

    const categorized = genuinelyNew.map((transaction) => ({
      ...transaction,
      category: matchCategoryForDescription(transaction.description, rules ?? []) ?? UNCATEGORIZED,
    }));

    const { data: batchRow, error: batchError } = await supabase
      .from("upload_batches")
      .insert({
        user_id: user.id,
        source_bank: sourceBank,
        transaction_count: categorized.length,
        skipped_count: skippedCount,
      })
      .select("id, source_bank, transaction_count, skipped_count, created_at")
      .single();

    if (batchError) throw new Error(batchError.message);

    const newBatch: UploadBatch = {
      id: batchRow.id,
      sourceBank: batchRow.source_bank,
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
      .update({ category: category.name })
      .eq("id", transaction.id);

    if (updateError) throw new Error(updateError.message);

    // Upsert the rule by keyword so repeatedly re-categorizing the same
    // merchant updates the existing rule instead of piling up duplicates.
    const keyword = extractKeyword(transaction.description);
    const { data: existingRules, error: findError } = await supabase
      .from("transaction_rules")
      .select("id")
      .eq("user_id", user.id)
      .ilike("keyword", keyword)
      .limit(1);

    if (findError) throw new Error(findError.message);

    if (existingRules && existingRules.length > 0) {
      const { error: updateRuleError } = await supabase
        .from("transaction_rules")
        .update({ category_id: category.id })
        .eq("id", existingRules[0].id);

      if (updateRuleError) throw new Error(updateRuleError.message);
    } else {
      const { error: insertRuleError } = await supabase.from("transaction_rules").insert({
        user_id: user.id,
        keyword,
        category_id: category.id,
      });

      if (insertRuleError) throw new Error(insertRuleError.message);
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === transaction.id ? { ...t, category: category.name } : t))
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

  return (
    <TransactionsContext.Provider
      value={{ transactions, batches, isLoading, addTransactions, assignCategory, deleteBatch }}
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
