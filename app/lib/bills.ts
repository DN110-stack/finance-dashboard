import type { Transaction } from "./csv";
import { parseISODate, toISODate } from "./period";

export type BillFrequency =
  | "once"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "bi-annual"
  | "annual";

export const BILL_FREQUENCIES: BillFrequency[] = [
  "once",
  "weekly",
  "fortnightly",
  "monthly",
  "quarterly",
  "bi-annual",
  "annual",
];

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  once: "One-off",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "bi-annual": "Every 6 months",
  annual: "Annual",
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  dueDate: string; // "YYYY-MM-DD" — the anchor every later due date derives from (the only one, for a one-off)
  endDate: string | null;
  category: string | null;
  amountVaries: boolean; // amount is an estimate (e.g. utilities)
  matchKeyword: string | null;
  isActive: boolean;
};

export type BillPayment = {
  id: string;
  billId: string;
  dueDate: string;
};

export type BillStatus = "paid" | "overdue" | "dueSoon" | "upcoming";

export type BillOccurrence = {
  bill: Bill;
  dueDate: string;
  status: BillStatus;
  // Set when an uploaded transaction matched this occurrence automatically.
  matchedTransaction: Transaction | null;
  // Set when the user marked this occurrence paid by hand.
  paymentId: string | null;
};

const MONTH_INTERVAL: Partial<Record<BillFrequency, number>> = {
  monthly: 1,
  quarterly: 3,
  "bi-annual": 6,
  annual: 12,
};

// Always derived from the anchor rather than the previous date, so a bill
// anchored on the 31st lands on the 31st in long months and the last day in
// short ones, with no drift after passing through February.
function addMonthsClamped(anchor: Date, months: number): Date {
  const first = new Date(anchor.getFullYear(), anchor.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(anchor.getDate(), lastDay));
}

function nthDueDate(bill: Bill, n: number): Date {
  const anchor = parseISODate(bill.dueDate);
  if (bill.frequency === "weekly") {
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * n);
  }
  if (bill.frequency === "fortnightly") {
    return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 14 * n);
  }
  return addMonthsClamped(anchor, (MONTH_INTERVAL[bill.frequency] ?? 1) * n);
}

// Every due date of `bill` inside the inclusive [from, to] range.
export function dueDatesInRange(bill: Bill, from: string, to: string): string[] {
  // A one-off bill has a single due date and never repeats.
  if (bill.frequency === "once") {
    return bill.dueDate >= from && bill.dueDate <= to ? [bill.dueDate] : [];
  }

  const dates: string[] = [];
  // Generous cap so a malformed far-past anchor can never loop forever.
  for (let n = 0; n < 5000; n++) {
    const iso = toISODate(nthDueDate(bill, n));
    if (iso > to) break;
    if (bill.endDate && iso > bill.endDate) break;
    if (iso >= from) dates.push(iso);
  }
  return dates;
}

function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

function dayDifference(a: string, b: string): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

// How far either side of the due date a payment may land and still count —
// tight for weekly bills so neighbouring occurrences can't steal each
// other's payment, looser for monthly+ bills that often clear a few days late.
function matchWindow(frequency: BillFrequency): { before: number; after: number } {
  if (frequency === "weekly") return { before: 3, after: 3 };
  if (frequency === "fortnightly") return { before: 5, after: 7 };
  return { before: 5, after: 10 };
}

export function getMatchKeyword(bill: Bill): string {
  return (bill.matchKeyword?.trim() || bill.name.trim()).toLowerCase();
}

// Builds the schedule of bill occurrences in [from, to] with each one's
// status. An occurrence is paid when the user marked it so, or when an
// expense transaction containing the bill's keyword landed inside the match
// window around the due date.
export function buildBillSchedule({
  bills,
  payments,
  transactions,
  from,
  to,
  today,
  remindDays,
}: {
  bills: Bill[];
  payments: BillPayment[];
  transactions: Transaction[];
  from: string;
  to: string;
  today: string;
  remindDays: number;
}): BillOccurrence[] {
  const paymentByKey = new Map(payments.map((p) => [`${p.billId}|${p.dueDate}`, p]));
  const remindUntil = addDays(today, remindDays);
  const expenses = transactions.filter((t) => t.amount < 0 && t.id);
  const occurrences: BillOccurrence[] = [];

  for (const bill of bills) {
    if (!bill.isActive) continue;

    const keyword = getMatchKeyword(bill);
    const { before, after } = matchWindow(bill.frequency);
    const candidates = keyword
      ? expenses.filter((t) => t.description.toLowerCase().includes(keyword))
      : [];
    const usedTransactionIds = new Set<string>();

    // Chronological, so an earlier occurrence claims its payment first.
    for (const dueDate of dueDatesInRange(bill, from, to)) {
      const payment = paymentByKey.get(`${bill.id}|${dueDate}`) ?? null;

      let matched: Transaction | null = null;
      if (!payment) {
        const lower = addDays(dueDate, -before);
        const upper = addDays(dueDate, after);
        for (const t of candidates) {
          if (usedTransactionIds.has(t.id!) || t.date < lower || t.date > upper) continue;
          if (
            matched === null ||
            Math.abs(dayDifference(t.date, dueDate)) < Math.abs(dayDifference(matched.date, dueDate))
          ) {
            matched = t;
          }
        }
        if (matched) usedTransactionIds.add(matched.id!);
      }

      let status: BillStatus;
      if (payment || matched) status = "paid";
      else if (dueDate < today) status = "overdue";
      else if (dueDate <= remindUntil) status = "dueSoon";
      else status = "upcoming";

      occurrences.push({
        bill,
        dueDate,
        status,
        matchedTransaction: matched,
        paymentId: payment?.id ?? null,
      });
    }
  }

  return occurrences.sort((a, b) =>
    a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.bill.name.localeCompare(b.bill.name)
  );
}

// What a bill costs per month, averaged — used for the Bills page totals.
export function monthlyCost(bill: Bill): number {
  switch (bill.frequency) {
    case "once":
      return 0; // one-offs aren't a running cost, so they're left out of monthly/yearly totals
    case "weekly":
      return (bill.amount * 52) / 12;
    case "fortnightly":
      return (bill.amount * 26) / 12;
    case "monthly":
      return bill.amount;
    case "quarterly":
      return bill.amount / 3;
    case "bi-annual":
      return bill.amount / 6;
    case "annual":
      return bill.amount / 12;
  }
}

export function formatDueDate(iso: string, today: string): string {
  const diff = dayDifference(iso, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function daysUntil(iso: string, today: string): number {
  return dayDifference(iso, today);
}

// --- Reminder window preference -------------------------------------------

export const REMIND_DAY_OPTIONS = [3, 5, 7, 14];
const DEFAULT_REMIND_DAYS = 7;
const REMIND_STORAGE_KEY = "finance-dashboard:bill-remind-days";

function readRemindDays(): number {
  try {
    const raw = window.localStorage.getItem(REMIND_STORAGE_KEY);
    if (!raw) return DEFAULT_REMIND_DAYS;
    const parsed = JSON.parse(raw);
    return REMIND_DAY_OPTIONS.includes(parsed) ? parsed : DEFAULT_REMIND_DAYS;
  } catch {
    return DEFAULT_REMIND_DAYS;
  }
}

// Same localStorage-backed external store pattern as chartLayoutStore.
let cachedRemindDays: number | null = null;
const remindListeners = new Set<() => void>();

export const billReminderStore = {
  subscribe(callback: () => void) {
    remindListeners.add(callback);
    return () => remindListeners.delete(callback);
  },
  getSnapshot(): number {
    if (cachedRemindDays === null) cachedRemindDays = readRemindDays();
    return cachedRemindDays;
  },
  getServerSnapshot(): number {
    return DEFAULT_REMIND_DAYS;
  },
  set(days: number) {
    cachedRemindDays = days;
    try {
      window.localStorage.setItem(REMIND_STORAGE_KEY, JSON.stringify(days));
    } catch {
      // Persistence is a nice-to-have — see chartLayoutStore.
    }
    remindListeners.forEach((listener) => listener());
  },
};

// --- Upcoming bills view preference ----------------------------------------

export type BillsView = "list" | "calendar";
const VIEW_STORAGE_KEY = "finance-dashboard:bills-view";

function readView(): BillsView {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === "calendar" ? "calendar" : "list";
  } catch {
    return "list";
  }
}

let cachedView: BillsView | null = null;
const viewListeners = new Set<() => void>();

export const billsViewStore = {
  subscribe(callback: () => void) {
    viewListeners.add(callback);
    return () => viewListeners.delete(callback);
  },
  getSnapshot(): BillsView {
    if (cachedView === null) cachedView = readView();
    return cachedView;
  },
  getServerSnapshot(): BillsView {
    return "list";
  },
  set(view: BillsView) {
    cachedView = view;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Persistence is a nice-to-have — see chartLayoutStore.
    }
    viewListeners.forEach((listener) => listener());
  },
};
