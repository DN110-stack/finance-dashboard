"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export type AnnualBudget = {
  id: string;
  amount: number;
  year: string; // "YYYY"
  isGroup: boolean;
  category: string | null; // set when !isGroup
  groupName: string | null; // set when isGroup
  groupCategories: string[] | null; // set when isGroup
};

type AnnualBudgetRow = {
  id: string;
  category: string | null;
  amount: number | string;
  year: string;
  is_group: boolean;
  group_categories: string[] | null;
  group_name: string | null;
};

function fromRow(row: AnnualBudgetRow): AnnualBudget {
  return {
    id: row.id,
    amount: Number(row.amount),
    year: row.year,
    isGroup: row.is_group,
    category: row.category,
    groupName: row.group_name,
    groupCategories: row.group_categories,
  };
}

const SELECT_COLUMNS = "id, category, amount, year, is_group, group_categories, group_name";

type AnnualBudgetsContextValue = {
  annualBudgets: AnnualBudget[];
  isLoading: boolean;
  upsertAnnualBudget: (category: string, year: string, amount: number) => Promise<AnnualBudget>;
  addAnnualBudgetGroup: (
    name: string,
    year: string,
    amount: number,
    categories: string[]
  ) => Promise<AnnualBudget>;
  updateAnnualBudgetAmount: (id: string, amount: number) => Promise<AnnualBudget>;
  deleteAnnualBudget: (id: string) => Promise<void>;
};

const AnnualBudgetsContext = createContext<AnnualBudgetsContextValue | null>(null);

export function AnnualBudgetsProvider({ children }: { children: React.ReactNode }) {
  const [annualBudgets, setAnnualBudgets] = useState<AnnualBudget[]>([]);
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

      try {
        const { data, error } = await supabase
          .from("annual_budgets")
          .select(SELECT_COLUMNS)
          .eq("user_id", user.id);

        if (!error && data && !cancelled) {
          setAnnualBudgets(data.map(fromRow));
        }
      } catch {
        // Leave annual budgets empty rather than crash.
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

  // Saves a single-category annual budget row, creating it if this
  // (category, year) combination doesn't have one yet or updating the
  // existing amount if it does — the unique (user_id, category, year)
  // constraint is what makes the upsert safe rather than needing to look up
  // an id first.
  async function upsertAnnualBudget(
    category: string,
    year: string,
    amount: number
  ): Promise<AnnualBudget> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to set an annual budget");
    }

    const { data, error } = await supabase
      .from("annual_budgets")
      .upsert(
        { user_id: user.id, category, year, amount, is_group: false },
        { onConflict: "user_id,category,year" }
      )
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const budget = fromRow(data);
    setAnnualBudgets((prev) => {
      const existingIndex = prev.findIndex(
        (b) => !b.isGroup && b.category?.toLowerCase() === category.toLowerCase() && b.year === year
      );
      if (existingIndex === -1) return [...prev, budget];
      const next = [...prev];
      next[existingIndex] = budget;
      return next;
    });

    return budget;
  }

  // Annual budget groups don't have a natural conflict key to upsert against
  // (their category set can change), so creating one is always a plain
  // insert — AnnualBudgetManager is responsible for only offering categories
  // that aren't already claimed by another annual budget or group that year.
  async function addAnnualBudgetGroup(
    name: string,
    year: string,
    amount: number,
    categories: string[]
  ): Promise<AnnualBudget> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to create an annual budget group");
    }

    const { data, error } = await supabase
      .from("annual_budgets")
      .insert({
        user_id: user.id,
        year,
        amount,
        is_group: true,
        group_name: name,
        group_categories: categories,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const group = fromRow(data);
    setAnnualBudgets((prev) => [...prev, group]);
    return group;
  }

  async function updateAnnualBudgetAmount(id: string, amount: number): Promise<AnnualBudget> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("annual_budgets")
      .update({ amount })
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const budget = fromRow(data);
    setAnnualBudgets((prev) => prev.map((b) => (b.id === id ? budget : b)));
    return budget;
  }

  async function deleteAnnualBudget(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("annual_budgets").delete().eq("id", id);
    if (error) throw new Error(error.message);

    setAnnualBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <AnnualBudgetsContext.Provider
      value={{
        annualBudgets,
        isLoading,
        upsertAnnualBudget,
        addAnnualBudgetGroup,
        updateAnnualBudgetAmount,
        deleteAnnualBudget,
      }}
    >
      {children}
    </AnnualBudgetsContext.Provider>
  );
}

export function useAnnualBudgets() {
  const context = useContext(AnnualBudgetsContext);
  if (!context) {
    throw new Error("useAnnualBudgets must be used within an AnnualBudgetsProvider");
  }
  return context;
}
