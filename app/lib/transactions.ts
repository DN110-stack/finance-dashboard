import type { Transaction } from "./csv";

export const sampleTransactions: Transaction[] = [
  { date: "2026-06-01", description: "Whole Foods Market", category: "Food", amount: -86.42 },
  { date: "2026-06-01", description: "Monthly Rent", category: "Rent", amount: -1250.0 },
  { date: "2026-06-02", description: "Uber ride", category: "Transport", amount: -18.5 },
  { date: "2026-06-03", description: "Paycheck", category: "Income", amount: 2600.0 },
  { date: "2026-06-04", description: "Netflix subscription", category: "Entertainment", amount: -15.99 },
  { date: "2026-06-05", description: "Amazon order", category: "Shopping", amount: -64.3 },
  { date: "2026-06-07", description: "Trader Joe's", category: "Food", amount: -52.18 },
  { date: "2026-06-08", description: "Shell gas station", category: "Transport", amount: -41.75 },
  { date: "2026-06-10", description: "Movie tickets", category: "Entertainment", amount: -32.0 },
  { date: "2026-06-12", description: "Target", category: "Shopping", amount: -97.21 },
];
