"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export type Category = {
  id: string;
  name: string;
  colour: string;
};

type CategoriesContextValue = {
  categories: Category[];
  isLoading: boolean;
  addCategory: (name: string, colour: string) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
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
        .select("id, name, colour")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        setCategories(data);
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

  async function addCategory(name: string, colour: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to create a category");
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name, colour })
      .select("id, name, colour")
      .single();

    if (error) throw new Error(error.message);

    setCategories((prev) => sortByName([...prev, data]));
    return data;
  }

  async function deleteCategory(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);

    setCategories((prev) => prev.filter((category) => category.id !== id));
  }

  return (
    <CategoriesContext.Provider value={{ categories, isLoading, addCategory, deleteCategory }}>
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
