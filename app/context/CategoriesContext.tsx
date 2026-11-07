"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { emitCategoryNameReplaced } from "../lib/categoryEvents";

export type Category = {
  id: string;
  name: string;
  colour: string;
  parentCategory: string | null;
};

// How many records of each kind still reference a category by name.
export type CategoryUsage = {
  transactions: number;
  budgets: number;
  budget_groups: number;
  annual_budgets: number;
  goals: number;
  bills: number;
};

export function totalCategoryUsage(usage: CategoryUsage): number {
  return Object.values(usage).reduce((sum, count) => sum + count, 0);
}

type CategoryUpdates = {
  name: string;
  colour: string;
  parentCategory: string | null;
};

type CategoriesContextValue = {
  categories: Category[];
  isLoading: boolean;
  addCategory: (name: string, colour: string, parentCategory?: string | null) => Promise<Category>;
  updateCategory: (id: string, updates: CategoryUpdates) => Promise<Category>;
  getCategoryUsage: (id: string) => Promise<CategoryUsage>;
  // When anything still uses the category, `moveToId` names the category
  // that takes those records over — the database refuses the delete otherwise.
  deleteCategory: (id: string, moveToId?: string) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

function sortByName(categories: Category[]) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
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
        .from("categories")
        .select("id, name, colour, parent_category")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        setCategories(
          data.map((row) => ({
            id: row.id,
            name: row.name,
            colour: row.colour,
            parentCategory: row.parent_category,
          }))
        );
      }
      setIsLoading(false);
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

  async function addCategory(name: string, colour: string, parentCategory: string | null = null) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to create a category");
    }

    const trimmedName = name.trim();

    // Never create a second category that only differs by case — hand back
    // the existing one instead so callers can still assign it.
    const existing = categories.find(
      (category) => category.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) return existing;

    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: trimmedName, colour, parent_category: parentCategory })
      .select("id, name, colour, parent_category")
      .single();

    if (error) throw new Error(error.message);

    const category: Category = {
      id: data.id,
      name: data.name,
      colour: data.colour,
      parentCategory: data.parent_category,
    };

    setCategories((prev) => sortByName([...prev, category]));
    return category;
  }

  async function updateCategory(id: string, updates: CategoryUpdates) {
    const trimmedName = updates.name.trim();

    // Never let a rename collide (case-insensitively) with a *different*
    // existing category — same duplicate-prevention rule as addCategory.
    const collision = categories.find(
      (category) => category.id !== id && category.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (collision) {
      throw new Error(`"${trimmedName}" already exists as a category`);
    }

    // One database call renames the category and rewrites every
    // transaction, budget, goal and bill that referenced the old name, in a
    // single transaction — so a partial failure can't leave them out of sync.
    const supabase = createClient();
    const { error } = await supabase.rpc("rename_category", {
      p_id: id,
      p_name: trimmedName,
      p_colour: updates.colour,
      p_parent: updates.parentCategory,
    });

    if (error) throw new Error(error.message);

    const previous = categories.find((c) => c.id === id);
    const category: Category = {
      id,
      name: trimmedName,
      colour: updates.colour,
      parentCategory: updates.parentCategory,
    };

    if (previous && previous.name !== trimmedName) {
      emitCategoryNameReplaced(previous.name, trimmedName);
    }

    setCategories((prev) => sortByName(prev.map((c) => (c.id === id ? category : c))));
    return category;
  }

  async function getCategoryUsage(id: string): Promise<CategoryUsage> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("category_usage", { p_id: id });
    if (error) throw new Error(error.message);
    return data as CategoryUsage;
  }

  async function deleteCategory(id: string, moveToId?: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_category", {
      p_id: id,
      p_move_to: moveToId ?? null,
    });
    if (error) throw new Error(error.message);

    const deleted = categories.find((c) => c.id === id);
    const target = moveToId ? categories.find((c) => c.id === moveToId) : undefined;
    if (deleted && target) emitCategoryNameReplaced(deleted.name, target.name);

    setCategories((prev) => prev.filter((category) => category.id !== id));
  }

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        isLoading,
        addCategory,
        updateCategory,
        getCategoryUsage,
        deleteCategory,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories must be used within a CategoriesProvider");
  }
  return context;
}
