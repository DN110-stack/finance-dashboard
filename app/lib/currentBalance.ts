import type { Transaction } from "./csv";

// Current balance = opening balance + every transaction dated on/after the
// opening balance date. Unlike the dashboard's period-scoped calculations,
// this deliberately includes one-off transactions — they're still real
// money in or out of the account, just excluded from the "recurring
// spending" picture elsewhere.
export function computeCurrentBalance(
  transactions: Transaction[],
  openingBalance: number | null,
  openingBalanceDate: string | null
): number | null {
  if (openingBalance === null || openingBalanceDate === null) return null;

  const net = transactions
    .filter((t) => t.date >= openingBalanceDate)
    .reduce((sum, t) => sum + t.amount, 0);

  return Math.round((openingBalance + net) * 100) / 100;
}