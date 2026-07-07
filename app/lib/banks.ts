import type { BankFormat } from "./csv";

export const BANK_BADGE_STYLES: Record<BankFormat, string> = {
  NAB: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  Westpac: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};
