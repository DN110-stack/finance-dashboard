"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export type Budget = {
  id: string;
  category: string;
  amount: number;
  month: string; // "YYYY-MM"
};

export type BudgetGroup = {
  id: string;
  name: string;
  amount: number;
  month: string; // "YYYY-MM"
  categories: string[]; // category names
};

type BudgetsContextValue = {
  budgets: Budget[];
  budgetGroups: BudgetGroup[];
  isLoading: boolean;
  upsertBudget: (category: string, month: string, amount: number) => Promise<Budget>;
  deleteBudget: (id: string) => Promise<void>;
  addBudgetGroup: (
    name: string,
    month: string,
    amount: number,
    categories: string[]
  ) => Promise<BudgetGroup>;
  updateBudgetGroupAmount: (id: string, amount: number) => Promise<BudgetGroup>;
  deleteBudgetGroup: (id: string) => Promise<void>;
};

const BudgetsContext = createContext<BudgetsContextValue | null>(null);

export function BudgetsProvider({ children }: { children: React.ReactNode }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>([]);
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

      // Fetched independently — a failure loading one shouldn't blank out
      // the other if it loaded fine.
      try {
        const { data, error } = await supabase
          .from("budgets")
          .select("id, category, amount, month")
          .eq("user_id", user.id);

        if (!error && data && !cancelled) {
          setBudgets(
            data.map((row) => ({
              id: row.id,
              category: row.category,
              amount: Number(row.amount),
              month: row.month,
            }))
          );
        }
      } catch {
        // Leave budgets empty rather than crash.
      }

      try {
        const { data, error } = await supabase
          .from("budget_groups")
          .select("id, name, amount, month, categories")
          .eq("user_id", user.id);

        if (!error && data && !cancelled) {
          setBudgetGroups(
            data.map((row) => ({
              id: row.id,
              name: row.name,
              amount: Number(row.amount),
              month: row.month,
              categories: row.categories ?? [],
            }))
          );
        }
      } catch {
        // Leave budget groups empty rather than crash.
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

  // Saves a budget row, creating it if this (category, month) combination
  // doesn't have one yet or updating the existing amount if it does — the
  // unique (user_id, category, month) constraint is what makes the upsert
  // safe rather than needing to look up an id first.
  async function upsertBudget(category: string, month: string, amount: number): Promise<Budget> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to set a budget");
    }

    const { data, error } = await supabase
      .from("budgets")
      .upsert(
        { user_id: user.id, category, month, amount },
        { onConflict: "user_id,category,month" }
      )
      .select("id, category, amount, month")
      .single();

    if (error) throw new Error(error.message);

    const budget: Budget = {
      id: data.id,
      category: data.category,
      amount: Number(data.amount),
      month: data.month,
    };

    setBudgets((prev) => {
      const existingIndex = prev.findIndex(
        (b) => b.category.toLowerCase() === category.toLowerCase() && b.month === month
      );
      if (existingIndex === -1) return [...prev, budget];
      const next = [...prev];
      next[existingIndex] = budget;
      return next;
    });

    return budget;
  }

  async function deleteBudget(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) throw new Error(error.message);

    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  // Budget groups don't have a natural conflict key to upsert against (their
  // category set can change), so creating one is always a plain insert —
  // BudgetManager is responsible for only offering categories that aren't
  // already claimed by another budget or group that month.
  async function addBudgetGroup(
    name: string,
    month: string,
    amount: number,
    categories: string[]
  ): Promise<BudgetGroup> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to create a budget group");
    }

    const { data, error } = await supabase
      .from("budget_groups")
      .insert({ user_id: user.id, name, month, amount, categories })
      .select("id, name, amount, month, categories")
      .single();

    if (error) throw new Error(error.message);

    const group: BudgetGroup = {
      id: data.id,
      name: data.name,
      amount: Number(data.amount),
      month: data.month,
      categories: data.categories ?? [],
    };

    setBudgetGroups((prev) => [...prev, group]);
    return group;
  }

  async function updateBudgetGroupAmount(id: string, amount: number): Promise<BudgetGroup> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("budget_groups")
      .update({ amount })
      .eq("id", id)
      .select("id, name, amount, month, categories")
      .single();

    if (error) throw new Error(error.message);

    const group: BudgetGroup = {
      id: data.id,
      name: data.name,
      amount: Number(data.amount),
      month: data.month,
      categories: data.categories ?? [],
    };

    setBudgetGroups((prev) => prev.map((g) => (g.id === id ? group : g)));
    return group;
  }

  async function deleteBudgetGroup(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("budget_groups").delete().eq("id", id);
    if (error) throw new Error(error.message);

    setBudgetGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <BudgetsContext.Provider
      value={{
        budgets,
        budgetGroups,
        isLoading,
        upsertBudget,
        deleteBudget,
        addBudgetGroup,
        updateBudgetGroupAmount,
        deleteBudgetGroup,
      }}
    >
      {children}
    </BudgetsContext.Provider>
  );
}

export function useBudgets() {
  const context = useContext(BudgetsContext);
  if (!context) {
    throw new Error("useBudgets must be used within a BudgetsProvider");
  }
  return context;
}
