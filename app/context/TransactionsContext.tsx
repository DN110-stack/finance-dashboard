"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { BankFormat, Transaction } from "../lib/csv";
import { createClient } from "../lib/supabase/client";
import type { Category } from "./CategoriesContext";
import { extractKeyword, matchCategoryForDescription, UNCATEGORIZED } from "../lib/rules";

type TransactionsContextValue = {
  transactions: Transaction[];
  isLoading: boolean;
  addTransactions: (transactions: Transaction[], sourceBank: BankFormat) => Promise<Transaction[]>;
  assignCategory: (transaction: Transaction, category: Category) => Promise<void>;
};

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

function sortByDate(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

      const { data, error } = await supabase
        .from("transactions")
        .select("id, date, description, category, amount")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        setTransactions(
          data.map((row) => ({
            id: row.id,
            date: row.date,
            description: row.description,
            category: row.category,
            amount: Number(row.amount),
          }))
        );
      }
      setIsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function addTransactions(newTransactions: Transaction[], sourceBank: BankFormat) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to upload transactions");
    }

    const { data: rules, error: rulesError } = await supabase
      .from("transaction_rules")
      .select("keyword, categories(name)")
      .eq("user_id", user.id);

    if (rulesError) throw new Error(rulesError.message);

    const categorized = newTransactions.map((transaction) => ({
      ...transaction,
      category: matchCategoryForDescription(transaction.description, rules ?? []) ?? UNCATEGORIZED,
    }));

    const rows = categorized.map((transaction) => ({
      user_id: user.id,
      date: transaction.date,
      description: transaction.description,
      category: transaction.category,
      amount: transaction.amount,
      source_bank: sourceBank,
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
    return insertedTransactions;
  }

  async function assignCategory(transaction: Transaction, category: Category) {
    if (!transaction.id) {
      throw new Error("This transaction can't be updated");
    }

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

    const { error: ruleError } = await supabase.from("transaction_rules").insert({
      user_id: user.id,
      keyword: extractKeyword(transaction.description),
      category_id: category.id,
    });

    if (ruleError) throw new Error(ruleError.message);

    setTransactions((prev) =>
      prev.map((t) => (t.id === transaction.id ? { ...t, category: category.name } : t))
    );
  }

  return (
    <TransactionsContext.Provider
      value={{ transactions, isLoading, addTransactions, assignCategory }}
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
