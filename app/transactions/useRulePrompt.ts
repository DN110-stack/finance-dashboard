"use client";

import { useConfirm } from "../components/ConfirmDialog";
import type { Category } from "../context/CategoriesContext";
import type { Transaction } from "../lib/csv";
import { createRuleMatcher, extractKeyword, type RuleAmountSign } from "../lib/rules";
import { createRule, fetchRules } from "../lib/rulesApi";

// After a manual category change, offers to turn it into a rule so similar
// transactions are filed the same way next time. Nothing is created unless
// the user says yes — changing a category by hand never makes a rule on its own.
export function useRulePrompt() {
  const confirm = useConfirm();

  return async function offerRule(transaction: Transaction, category: Category) {
    const pattern = extractKeyword(transaction.description);
    if (!pattern) return;

    // Skip the question when an existing rule already files this the same way.
    try {
      const existing = createRuleMatcher(await fetchRules()).findRule(
        transaction.description,
        transaction.amount
      );
      if (existing?.categoryId === category.id) return;
    } catch {
      return; // can't read rules (e.g. not set up yet) — don't nag
    }

    const amountSign: RuleAmountSign = transaction.amount < 0 ? "debit" : "credit";
    const confirmed = await confirm({
      title: "Create a rule for similar transactions?",
      message: `Always file ${amountSign === "debit" ? "spending" : "money in"} containing "${pattern}" under ${category.name}? You can edit or remove it under Settings → Rules.`,
      confirmLabel: "Create rule",
    });
    if (!confirmed) return;

    await createRule({
      pattern,
      matchType: "contains",
      amountSign,
      categoryId: category.id,
      wholeWord: false,
      enabled: true,
    });
  };
}
