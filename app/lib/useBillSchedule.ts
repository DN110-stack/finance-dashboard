"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useBills } from "../context/BillsContext";
import { useTransactions } from "../context/TransactionsContext";
import { billReminderStore, buildBillSchedule, type BillOccurrence } from "./bills";

// Bill occurrences in [from, to] with paid/overdue/due-soon status, using
// the user's saved reminder window. Shared by the Bills page, the dashboard
// reminder banner and the dashboard summary cards.
export function useBillSchedule(from: string, to: string, today: string): {
  occurrences: BillOccurrence[];
  isLoading: boolean;
  remindDays: number;
} {
  const { bills, payments, isLoading: billsLoading } = useBills();
  const { transactions, isLoading: transactionsLoading } = useTransactions();
  const remindDays = useSyncExternalStore(
    billReminderStore.subscribe,
    billReminderStore.getSnapshot,
    billReminderStore.getServerSnapshot
  );

  const occurrences = useMemo(
    () => buildBillSchedule({ bills, payments, transactions, from, to, today, remindDays }),
    [bills, payments, transactions, from, to, today, remindDays]
  );

  return { occurrences, isLoading: billsLoading || transactionsLoading, remindDays };
}
