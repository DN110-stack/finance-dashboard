"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Transaction } from "../lib/csv";
import { sampleTransactions } from "../lib/transactions";

const STORAGE_KEY = "finance-dashboard:transactions";

type TransactionsContextValue = {
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
};

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactionsState] = useState<Transaction[]>(sampleTransactions);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      setTransactionsState(JSON.parse(stored) as Transaction[]);
    } catch {
      // ignore malformed stored data and keep the sample transactions
    }
  }, []);

  function setTransactions(next: Transaction[]) {
    setTransactionsState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <TransactionsContext.Provider value={{ transactions, setTransactions }}>
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
