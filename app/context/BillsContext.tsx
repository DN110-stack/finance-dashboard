"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import type { Bill, BillFrequency, BillPayment } from "../lib/bills";

export type BillInput = {
  name: string;
  amount: number;
  frequency: BillFrequency;
  dueDate: string;
  endDate: string | null;
  category: string | null;
  amountVaries: boolean;
  matchKeyword: string | null;
};

type BillsContextValue = {
  bills: Bill[];
  payments: BillPayment[];
  isLoading: boolean;
  addBill: (input: BillInput) => Promise<Bill>;
  updateBill: (id: string, input: BillInput) => Promise<Bill>;
  setBillActive: (id: string, isActive: boolean) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  markPaid: (billId: string, dueDate: string) => Promise<void>;
  unmarkPaid: (paymentId: string) => Promise<void>;
};

const BillsContext = createContext<BillsContextValue | null>(null);

const BILL_COLUMNS =
  "id, name, amount, frequency, due_date, end_date, category, amount_varies, match_keyword, is_active";

function fromRow(row: {
  id: string;
  name: string;
  amount: number | string;
  frequency: BillFrequency;
  due_date: string;
  end_date: string | null;
  category: string | null;
  amount_varies: boolean;
  match_keyword: string | null;
  is_active: boolean;
}): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    frequency: row.frequency,
    dueDate: row.due_date,
    endDate: row.end_date,
    category: row.category,
    amountVaries: row.amount_varies,
    matchKeyword: row.match_keyword,
    isActive: row.is_active,
  };
}

function toRowFields(input: BillInput) {
  return {
    name: input.name,
    amount: input.amount,
    frequency: input.frequency,
    due_date: input.dueDate,
    end_date: input.endDate,
    category: input.category,
    amount_varies: input.amountVaries,
    match_keyword: input.matchKeyword,
  };
}

function sortByName(bills: Bill[]) {
  return [...bills].sort((a, b) => a.name.localeCompare(b.name));
}

export function BillsProvider({ children }: { children: React.ReactNode }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
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
        const [billsResult, paymentsResult] = await Promise.all([
          supabase.from("bills").select(BILL_COLUMNS).eq("user_id", user.id),
          supabase.from("bill_payments").select("id, bill_id, due_date").eq("user_id", user.id),
        ]);

        if (!cancelled) {
          if (!billsResult.error && billsResult.data) {
            setBills(sortByName(billsResult.data.map(fromRow)));
          }
          if (!paymentsResult.error && paymentsResult.data) {
            setPayments(
              paymentsResult.data.map((row) => ({
                id: row.id,
                billId: row.bill_id,
                dueDate: row.due_date,
              }))
            );
          }
        }
      } catch {
        // Leave bills empty rather than crash.
      }

      if (!cancelled) setIsLoading(false);
    }

    // See GoalsContext — a reload mid-fetch would otherwise log an
    // unhandled rejection even though `cancelled` guards the state updates.
    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  async function requireUserId(action: string): Promise<string> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(`You must be logged in to ${action}`);
    return user.id;
  }

  async function addBill(input: BillInput): Promise<Bill> {
    const userId = await requireUserId("add a bill");
    const supabase = createClient();

    const { data, error } = await supabase
      .from("bills")
      .insert({ user_id: userId, ...toRowFields(input) })
      .select(BILL_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const bill = fromRow(data);
    setBills((prev) => sortByName([...prev, bill]));
    return bill;
  }

  async function updateBill(id: string, input: BillInput): Promise<Bill> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("bills")
      .update(toRowFields(input))
      .eq("id", id)
      .select(BILL_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const bill = fromRow(data);
    setBills((prev) => sortByName(prev.map((b) => (b.id === id ? bill : b))));
    return bill;
  }

  async function setBillActive(id: string, isActive: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("bills").update({ is_active: isActive }).eq("id", id);
    if (error) throw new Error(error.message);

    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, isActive } : b)));
  }

  async function deleteBill(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) throw new Error(error.message);

    setBills((prev) => prev.filter((b) => b.id !== id));
    setPayments((prev) => prev.filter((p) => p.billId !== id));
  }

  async function markPaid(billId: string, dueDate: string) {
    const userId = await requireUserId("mark a bill paid");
    const supabase = createClient();

    const { data, error } = await supabase
      .from("bill_payments")
      .insert({ user_id: userId, bill_id: billId, due_date: dueDate })
      .select("id, bill_id, due_date")
      .single();

    if (error) throw new Error(error.message);

    setPayments((prev) => [...prev, { id: data.id, billId: data.bill_id, dueDate: data.due_date }]);
  }

  async function unmarkPaid(paymentId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("bill_payments").delete().eq("id", paymentId);
    if (error) throw new Error(error.message);

    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
  }

  return (
    <BillsContext.Provider
      value={{
        bills,
        payments,
        isLoading,
        addBill,
        updateBill,
        setBillActive,
        deleteBill,
        markPaid,
        unmarkPaid,
      }}
    >
      {children}
    </BillsContext.Provider>
  );
}

export function useBills() {
  const context = useContext(BillsContext);
  if (!context) {
    throw new Error("useBills must be used within a BillsProvider");
  }
  return context;
}
