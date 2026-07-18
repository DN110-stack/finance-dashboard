"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import type { Goal, GoalType } from "../lib/goals";

export type NewGoalInput = {
  name: string;
  type: GoalType;
  targetAmount: number;
  targetDate: string;
  category: string | null;
  startingBalance: number | null;
  monthlyPayment: number | null;
  colour: string;
  emoji: string;
  notes: string | null;
};

export type GoalUpdates = Partial<{
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string | null;
  startingBalance: number | null;
  monthlyPayment: number | null;
  colour: string;
  emoji: string;
  notes: string | null;
  isCompleted: boolean;
}>;

type GoalsContextValue = {
  goals: Goal[];
  isLoading: boolean;
  addGoal: (input: NewGoalInput) => Promise<Goal>;
  updateGoal: (id: string, updates: GoalUpdates) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
};

const GoalsContext = createContext<GoalsContextValue | null>(null);

const GOAL_COLUMNS =
  "id, name, type, target_amount, current_amount, target_date, category, starting_balance, monthly_payment, colour, emoji, notes, is_completed, created_at";

function fromRow(row: {
  id: string;
  name: string;
  type: GoalType;
  target_amount: number | string;
  current_amount: number | string;
  target_date: string;
  category: string | null;
  starting_balance: number | string | null;
  monthly_payment: number | string | null;
  colour: string;
  emoji: string;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
}): Goal {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    targetDate: row.target_date,
    category: row.category,
    startingBalance: row.starting_balance === null ? null : Number(row.starting_balance),
    monthlyPayment: row.monthly_payment === null ? null : Number(row.monthly_payment),
    colour: row.colour,
    emoji: row.emoji,
    notes: row.notes,
    isCompleted: row.is_completed,
    createdAt: row.created_at,
  };
}

function sortByTargetDate(goals: Goal[]) {
  return [...goals].sort((a, b) => (a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : 0));
}

export function GoalsProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
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
          .from("goals")
          .select(GOAL_COLUMNS)
          .eq("user_id", user.id);

        if (!error && data && !cancelled) {
          setGoals(sortByTargetDate(data.map(fromRow)));
        }
      } catch {
        // Leave goals empty rather than crash.
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

  async function addGoal(input: NewGoalInput): Promise<Goal> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to create a goal");
    }

    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: user.id,
        name: input.name,
        type: input.type,
        target_amount: input.targetAmount,
        current_amount: 0,
        target_date: input.targetDate,
        category: input.category,
        starting_balance: input.startingBalance,
        monthly_payment: input.monthlyPayment,
        colour: input.colour,
        emoji: input.emoji,
        notes: input.notes,
      })
      .select(GOAL_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const goal = fromRow(data);
    setGoals((prev) => sortByTargetDate([...prev, goal]));
    return goal;
  }

  async function updateGoal(id: string, updates: GoalUpdates): Promise<Goal> {
    const supabase = createClient();

    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.targetAmount !== undefined) payload.target_amount = updates.targetAmount;
    if (updates.currentAmount !== undefined) payload.current_amount = updates.currentAmount;
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.startingBalance !== undefined) payload.starting_balance = updates.startingBalance;
    if (updates.monthlyPayment !== undefined) payload.monthly_payment = updates.monthlyPayment;
    if (updates.colour !== undefined) payload.colour = updates.colour;
    if (updates.emoji !== undefined) payload.emoji = updates.emoji;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.isCompleted !== undefined) payload.is_completed = updates.isCompleted;

    const { data, error } = await supabase
      .from("goals")
      .update(payload)
      .eq("id", id)
      .select(GOAL_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const goal = fromRow(data);
    setGoals((prev) => sortByTargetDate(prev.map((g) => (g.id === id ? goal : g))));
    return goal;
  }

  async function deleteGoal(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) throw new Error(error.message);

    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <GoalsContext.Provider value={{ goals, isLoading, addGoal, updateGoal, deleteGoal }}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals() {
  const context = useContext(GoalsContext);
  if (!context) {
    throw new Error("useGoals must be used within a GoalsProvider");
  }
  return context;
}
