"use client";

import { useState, useSyncExternalStore } from "react";
import { useConfirm } from "../components/ConfirmDialog";
import { CalendarDays, Check, List, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useBills, type BillInput } from "../context/BillsContext";
import {
  BILL_FREQUENCY_LABELS,
  REMIND_DAY_OPTIONS,
  billReminderStore,
  billsViewStore,
  formatDueDate,
  monthlyCost,
  type Bill,
  type BillOccurrence,
  type BillStatus,
} from "../lib/bills";
import { toISODate } from "../lib/period";
import { useBillSchedule } from "../lib/useBillSchedule";
import BillForm from "./BillForm";
import BillsCalendar from "./BillsCalendar";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const STATUS_STYLES: Record<BillStatus, { label: string; className: string }> = {
  paid: {
    label: "Paid",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  },
  dueSoon: {
    label: "Due soon",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
  },
};

// Window shown in "Coming up": a couple of weeks back so a just-missed bill
// stays visible, and two months ahead.
const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 60;

function offsetDate(days: number): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

export default function BillsManager() {
  const confirm = useConfirm();
  const { bills, isLoading, addBill, updateBill, setBillActive, deleteBill, markPaid, unmarkPaid } =
    useBills();
  const remindDays = useSyncExternalStore(
    billReminderStore.subscribe,
    billReminderStore.getSnapshot,
    billReminderStore.getServerSnapshot
  );

  const view = useSyncExternalStore(
    billsViewStore.subscribe,
    billsViewStore.getSnapshot,
    billsViewStore.getServerSnapshot
  );

  const today = toISODate(new Date());
  const { occurrences } = useBillSchedule(offsetDate(-LOOKBACK_DAYS), offsetDate(LOOKAHEAD_DAYS), today);

  const [formBill, setFormBill] = useState<Bill | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const activeBills = bills.filter((b) => b.isActive);
  const monthlyTotal = activeBills.reduce((sum, b) => sum + monthlyCost(b), 0);

  function openForm(bill: Bill | null) {
    setFormBill(bill);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: BillInput) {
    setIsSaving(true);
    try {
      if (formBill) await updateBill(formBill.id, input);
      else await addBill(input);
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function run(key: string, action: () => Promise<void>) {
    setError(null);
    setBusyKey(key);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(bill: Bill) {
    if (!await confirm({
      message: `Delete "${bill.name}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    })) return;
    await run(bill.id, () => deleteBill(bill.id));
  }

  function renderOccurrence(occurrence: BillOccurrence) {
    const { bill, dueDate, status, matchedTransaction, paymentId } = occurrence;
    const key = `${bill.id}|${dueDate}`;
    const style = STATUS_STYLES[status];

    return (
      <li
        key={key}
        className="flex items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{bill.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
              {style.label}
            </span>
          </div>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {formatDueDate(dueDate, today)}
            {matchedTransaction ? ` · matched “${matchedTransaction.description}”` : ""}
            {bill.amountVaries ? " · estimate" : ""}
          </p>
        </div>
        <p className="shrink-0 font-semibold">
          {bill.amountVaries ? "~" : ""}
          {currencyFormatter.format(matchedTransaction ? Math.abs(matchedTransaction.amount) : bill.amount)}
        </p>
        {status !== "paid" && (
          <button
            type="button"
            onClick={() => run(key, () => markPaid(bill.id, dueDate))}
            disabled={busyKey === key}
            aria-label={`Mark ${bill.name} paid`}
            className="flex min-h-[44px] items-center gap-1 rounded-md border border-black/10 px-3 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Mark paid</span>
          </button>
        )}
        {paymentId && (
          <button
            type="button"
            onClick={() => run(key, () => unmarkPaid(paymentId))}
            disabled={busyKey === key}
            aria-label={`Undo paid for ${bill.name}`}
            className="flex min-h-[44px] items-center gap-1 rounded-md px-3 text-sm text-zinc-500 transition-colors hover:bg-black/5 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <Undo2 className="h-4 w-4" />
            <span className="hidden sm:inline">Undo</span>
          </button>
        )}
      </li>
    );
  }

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-black/10 p-3 sm:p-4 dark:border-white/10">
          <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">Fixed costs per month</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl">{currencyFormatter.format(monthlyTotal)}</p>
        </div>
        <div className="rounded-lg border border-black/10 p-3 sm:p-4 dark:border-white/10">
          <p className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">Fixed costs per year</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl">
            {currencyFormatter.format(monthlyTotal * 12)}
          </p>
        </div>
        <label className="col-span-2 flex flex-col justify-center gap-1 rounded-lg border border-black/10 p-3 text-xs text-zinc-500 sm:p-4 sm:text-sm lg:col-span-1 dark:border-white/10 dark:text-zinc-400">
          Remind me
          <select
            value={remindDays}
            onChange={(e) => billReminderStore.set(Number(e.target.value))}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-white/10 dark:text-white"
          >
            {REMIND_DAY_OPTIONS.map((days) => (
              <option key={days} value={days} className="text-zinc-900">
                {days} days before a bill is due
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Coming up</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-black/10 p-0.5 dark:border-white/10">
            {(
              [
                { value: "list", label: "List", icon: List },
                { value: "calendar", label: "Calendar", icon: CalendarDays },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => billsViewStore.set(option.value)}
                  aria-label={`${option.label} view`}
                  aria-pressed={view === option.value}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors ${
                    view === option.value
                      ? "bg-blue-600 text-white"
                      : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add bill
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {isLoading ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading bills…</p>
      ) : view === "calendar" ? (
        <BillsCalendar today={today} renderOccurrence={renderOccurrence} />
      ) : occurrences.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          {bills.length === 0
            ? "No bills yet. Add your rent, subscriptions and other regular payments to get reminders."
            : "Nothing due in the next two months."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">{occurrences.map(renderOccurrence)}</ul>
      )}

      {bills.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">All bills</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {bills.map((bill) => (
              <li
                key={bill.id}
                className={`flex items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10 ${
                  bill.isActive ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{bill.name}</p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {bill.frequency === "once"
                      ? `One-off · due ${bill.dueDate}`
                      : BILL_FREQUENCY_LABELS[bill.frequency]}
                    {bill.category ? ` · ${bill.category}` : ""}
                    {bill.endDate ? ` · ends ${bill.endDate}` : ""}
                    {bill.isActive ? "" : " · paused"}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">
                  {bill.amountVaries ? "~" : ""}
                  {currencyFormatter.format(bill.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => run(bill.id, () => setBillActive(bill.id, !bill.isActive))}
                  disabled={busyKey === bill.id}
                  className="min-h-[44px] rounded-md px-2 text-sm text-zinc-500 transition-colors hover:bg-black/5 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/10"
                >
                  {bill.isActive ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => openForm(bill)}
                  aria-label={`Edit ${bill.name}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(bill)}
                  disabled={busyKey === bill.id}
                  aria-label={`Delete ${bill.name}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {isFormOpen && (
        <BillForm
          key={formBill?.id ?? "new"}
          bill={formBill}
          onSubmit={handleSubmit}
          onClose={() => setIsFormOpen(false)}
          isSaving={isSaving}
        />
      )}
    </>
  );
}
