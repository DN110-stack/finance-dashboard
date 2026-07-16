"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { monthlyEquivalentAmount, type PeriodType } from "../lib/budgetPeriods";

export type Budget = {
  id: string;
  category: string;
  amount: number; // always the monthly-equivalent — see budgetPeriods.ts
  month: string; // "YYYY-MM" — the recurrence anchor for non-monthly periods
  periodType: PeriodType;
  periodAmount: number | null; // raw per-period amount; null for period_type "monthly"
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
  upsertBudget: (
    category: string,
    month: string,
    amount: number,
    period?: { type: PeriodType; periodAmount: number }
  ) => Promise<Budget>;
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
          .select("id, category, amount, month, period_type, period_amount")
          .eq("user_id", user.id);

        if (!error && data && !cancelled) {
          setBudgets(
            data.map((row) => ({
              id: row.id,
              category: row.category,
              amount: Number(row.amount),
              month: row.month,
              periodType: row.period_type,
              periodAmount: row.period_amount === null ? null : Number(row.period_amount),
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
  //
  // `period` is omitted for every plain-monthly call site (including
  // carry-forward and copy-from-last-month, which never pass it): that path
  // writes period_type "monthly" / period_amount null and leaves `amount`
  // exactly as given, identical to this function's behavior before periods
  // existed. When provided, the raw `period.periodAmount` is stored as-is
  // and `amount` is (re)computed as its monthly-equivalent centrally, so
  // proration only ever happens in one place (budgetPeriods.ts). Callers
  // editing an existing non-monthly budget must always pass its own
  // `period` through — omitting it would silently downgrade the budget to
  // plain monthly and destroy its recurrence.
  async function upsertBudget(
    category: string,
    month: string,
    amount: number,
    period?: { type: PeriodType; periodAmount: number }
  ): Promise<Budget> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to set a budget");
    }

    const periodType: PeriodType = period?.type ?? "monthly";
    const periodAmount = period ? period.periodAmount : null;
    const computedAmount = period ? monthlyEquivalentAmount(period.periodAmount, period.type) : amount;

    const { data, error } = await supabase
      .from("budgets")
      .upsert(
        {
          user_id: user.id,
          category,
          month,
          amount: computedAmount,
          period_type: periodType,
          period_amount: periodAmount,
        },
        { onConflict: "user_id,category,month" }
      )
      .select("id, category, amount, month, period_type, period_amount")
      .single();

    if (error) throw new Error(error.message);

    const budget: Budget = {
      id: data.id,
      category: data.category,
      amount: Number(data.amount),
      month: data.month,
      periodType: data.period_type,
      periodAmount: data.period_amount === null ? null : Number(data.period_amount),
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
