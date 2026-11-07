"use client";

import { useMemo, useState } from "react";
import { useCategories } from "../../context/CategoriesContext";
import { useTransactions } from "../../context/TransactionsContext";
import BottomSheet from "../../components/BottomSheet";
import { groupCategoriesByParent } from "../../lib/categories";
import {
  RULE_AMOUNT_SIGN_LABELS,
  RULE_MATCH_TYPE_LABELS,
  createRuleMatcher,
  isValidRegex,
  type CategoryRule,
  type RuleAmountSign,
  type RuleMatchType,
} from "../../lib/rules";
import type { RuleInput } from "../../lib/rulesApi";

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10";

export default function RuleForm({
  rule,
  onSubmit,
  onClose,
  isSaving,
}: {
  rule: CategoryRule | null; // null = creating a new rule
  onSubmit: (input: RuleInput) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  const { categories } = useCategories();
  const { transactions } = useTransactions();

  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [matchType, setMatchType] = useState<RuleMatchType>(rule?.matchType ?? "contains");
  const [amountSign, setAmountSign] = useState<RuleAmountSign>(rule?.amountSign ?? "any");
  const [wholeWord, setWholeWord] = useState(rule?.wholeWord ?? false);
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  // Hidden categories aren't offered — except the one this rule already
  // uses, so editing an existing rule never silently drops its category.
  const pickable = useMemo(
    () => categories.filter((c) => !c.isHidden || c.id === rule?.categoryId),
    [categories, rule]
  );
  const groups = useMemo(() => groupCategoriesByParent(pickable), [pickable]);
  const regexInvalid = matchType === "regex" && pattern !== "" && !isValidRegex(pattern);

  // Live count of how many existing transactions this draft would match, so
  // an over-broad pattern shows up before it's saved.
  const matchCount = useMemo(() => {
    if (!pattern.trim() || regexInvalid) return null;
    const category = categories.find((c) => c.id === categoryId);
    const matcher = createRuleMatcher([
      {
        id: "draft",
        pattern,
        matchType,
        amountSign,
        categoryId: categoryId || "draft",
        categoryName: category?.name ?? "draft",
        priority: 0,
        enabled: true,
        wholeWord,
      },
    ]);
    return transactions.filter((t) => matcher.findRule(t.description, t.amount)).length;
  }, [pattern, matchType, amountSign, wholeWord, categoryId, categories, transactions, regexInvalid]);

  async function handleSubmit() {
    if (!pattern.trim()) return setError("Enter a pattern to match.");
    if (regexInvalid) return setError("That regular expression isn't valid.");
    if (!categoryId) return setError("Choose a category.");

    setError(null);
    try {
      await onSubmit({
        pattern: matchType === "regex" ? pattern : pattern.trim(),
        matchType,
        amountSign,
        categoryId,
        wholeWord: matchType === "contains" && wholeWord,
        enabled,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={rule ? "Edit rule" : "Add rule"}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-md border border-black/10 text-sm font-medium dark:border-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="min-h-[44px] flex-1 rounded-md bg-blue-600 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : rule ? "Save changes" : "Add rule"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Match
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as RuleMatchType)}
              className={inputClass}
            >
              {(Object.keys(RULE_MATCH_TYPE_LABELS) as RuleMatchType[]).map((type) => (
                <option key={type} value={type} className="text-zinc-900">
                  {RULE_MATCH_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Amount
            <select
              value={amountSign}
              onChange={(e) => setAmountSign(e.target.value as RuleAmountSign)}
              className={inputClass}
            >
              {(Object.keys(RULE_AMOUNT_SIGN_LABELS) as RuleAmountSign[]).map((sign) => (
                <option key={sign} value={sign} className="text-zinc-900">
                  {RULE_AMOUNT_SIGN_LABELS[sign]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Pattern
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={matchType === "regex" ? "^ATO\\d" : "e.g. NETFLIX"}
            className={`${inputClass} ${regexInvalid ? "border-red-500" : ""}`}
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {regexInvalid
              ? "That regular expression isn't valid."
              : matchCount === null
                ? "Not case-sensitive."
                : `Matches ${matchCount} existing transaction${matchCount === 1 ? "" : "s"}. Not case-sensitive.`}
          </span>
        </label>

        {matchType === "contains" && (
          <label className="flex min-h-[44px] items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Whole word only
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Stops &ldquo;AGL&rdquo; from matching &ldquo;AGLOW&rdquo;. Digits next to the word are fine.
              </span>
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            <option value="" disabled className="text-zinc-900">
              Choose a category…
            </option>
            {groups.map((group) => (
              <optgroup key={group.parent} label={group.parent}>
                {group.categories.map((category) => (
                  <option key={category.id} value={category.id} className="text-zinc-900">
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Rule is enabled
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </BottomSheet>
  );
}
