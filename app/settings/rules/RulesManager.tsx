"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "../../components/ConfirmDialog";
import { useTransactions } from "../../context/TransactionsContext";
import {
  RULE_AMOUNT_SIGN_LABELS,
  RULE_MATCH_TYPE_LABELS,
  UNCATEGORIZED,
  createRuleMatcher,
  sortRules,
  type CategoryRule,
} from "../../lib/rules";
import {
  createRule,
  deleteRule,
  fetchRules,
  saveRuleOrder,
  setRuleEnabled,
  updateRule,
  type RuleInput,
} from "../../lib/rulesApi";
import RuleForm from "./RuleForm";

type ApplyScope = "uncategorized" | "all";

type PlannedChange = {
  id: string;
  description: string;
  from: string;
  to: string;
  ruleId: string;
};

const PREVIEW_ROWS = 12;

export default function RulesManager() {
  const confirm = useConfirm();
  const { transactions, applyCategoryChanges } = useTransactions();

  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formRule, setFormRule] = useState<CategoryRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [scope, setScope] = useState<ApplyScope>("uncategorized");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRules()
      .then((loaded) => {
        if (!cancelled) setRules(sortRules(loaded));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `${err.message} — if you haven't yet, run the phase Q SQL in Supabase.`
              : "Failed to load rules"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // What applying every rule would change, given the chosen scope. Anything
  // whose category was set by hand is never touched, and a rule that's
  // disabled or has lost its category never matches.
  const { changes, changesByRule, lockedSkipped } = useMemo(() => {
    const matcher = createRuleMatcher(rules);
    const planned: PlannedChange[] = [];
    const perRule = new Map<string, number>();
    let skipped = 0;

    for (const t of transactions) {
      if (!t.id) continue;
      if (scope === "uncategorized" && t.category.toLowerCase() !== UNCATEGORIZED.toLowerCase()) continue;

      const rule = matcher.findRule(t.description, t.amount);
      if (!rule || !rule.categoryName) continue;
      if (rule.categoryName.toLowerCase() === t.category.toLowerCase()) continue;

      if (t.categoryLocked) {
        skipped++;
        continue;
      }

      planned.push({
        id: t.id,
        description: t.description,
        from: t.category,
        to: rule.categoryName,
        ruleId: rule.id,
      });
      perRule.set(rule.id, (perRule.get(rule.id) ?? 0) + 1);
    }

    return { changes: planned, changesByRule: perRule, lockedSkipped: skipped };
  }, [rules, transactions, scope]);

  async function run(id: string, action: () => Promise<void>) {
    setError(null);
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  function openForm(rule: CategoryRule | null) {
    setFormRule(rule);
    setIsFormOpen(true);
  }

  async function handleSubmit(input: RuleInput) {
    setIsSaving(true);
    try {
      if (formRule) {
        const saved = await updateRule(formRule.id, input);
        setRules((prev) => sortRules(prev.map((r) => (r.id === saved.id ? { ...saved, priority: r.priority } : r))));
      } else {
        const saved = await createRule(input);
        setRules((prev) => sortRules([...prev, saved]));
      }
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(rule: CategoryRule) {
    const confirmed = await confirm({
      title: "Delete rule?",
      message: `Delete the rule for "${rule.pattern}"? Transactions it already categorised keep their category.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    await run(rule.id, async () => {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    });
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rules.length) return;

    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    await run(rules[index].id, async () => {
      setRules(await saveRuleOrder(next));
    });
  }

  async function handleApply() {
    setIsApplying(true);
    setError(null);
    try {
      await applyCategoryChanges(changes.map(({ id, to }) => ({ id, category: to })));
      setApplyNotice(`Updated ${changes.length} transaction${changes.length === 1 ? "" : "s"}.`);
      setIsPreviewOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply rules");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
        Rules file new uploads into categories automatically. The first matching rule from the top
        wins, and a category you set by hand is never changed by a rule.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-3 sm:p-4 dark:border-white/10">
        <div className="min-w-0">
          <p className="text-sm font-medium">Apply rules to existing transactions</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {changes.length} would change
            {lockedSkipped > 0 ? ` · ${lockedSkipped} skipped (set by hand)` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ApplyScope)}
            aria-label="Which transactions to apply rules to"
            className="min-h-[44px] rounded-md border border-black/10 bg-transparent px-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          >
            <option value="uncategorized" className="text-zinc-900">
              Uncategorized only
            </option>
            <option value="all" className="text-zinc-900">
              All transactions
            </option>
          </select>
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            disabled={changes.length === 0}
            className="min-h-[44px] rounded-md border border-black/10 px-3 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
          >
            Preview &amp; apply
          </button>
        </div>
      </div>
      {applyNotice && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{applyNotice}</p>}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rules</h2>
        <button
          type="button"
          onClick={() => openForm(null)}
          className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add rule
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {isLoading ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading rules…</p>
      ) : rules.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No rules yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rules.map((rule, index) => {
            const wouldChange = changesByRule.get(rule.id) ?? 0;
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-2 rounded-lg border border-black/10 p-3 dark:border-white/10 ${
                  rule.enabled ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0 || busyId !== null}
                    aria-label={`Move ${rule.pattern} up`}
                    className="flex h-6 w-8 items-center justify-center rounded text-zinc-500 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === rules.length - 1 || busyId !== null}
                    aria-label={`Move ${rule.pattern} down`}
                    className="flex h-6 w-8 items-center justify-center rounded text-zinc-500 hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    <span className="font-mono text-sm">{rule.pattern}</span>
                    <span className="ml-2 text-zinc-400">→</span>{" "}
                    {rule.categoryName ?? (
                      <span className="text-red-600 dark:text-red-400">category deleted</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {RULE_MATCH_TYPE_LABELS[rule.matchType]}
                    {rule.matchType === "contains" && rule.wholeWord ? " (whole word)" : ""} ·{" "}
                    {RULE_AMOUNT_SIGN_LABELS[rule.amountSign]}
                    {wouldChange > 0 ? ` · would change ${wouldChange}` : ""}
                  </p>
                </div>

                <label className="flex min-h-[44px] items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    disabled={busyId === rule.id}
                    onChange={(e) =>
                      run(rule.id, async () => {
                        await setRuleEnabled(rule.id, e.target.checked);
                        setRules((prev) =>
                          prev.map((r) => (r.id === rule.id ? { ...r, enabled: e.target.checked } : r))
                        );
                      })
                    }
                    className="h-4 w-4"
                  />
                  <span className="hidden sm:inline">On</span>
                </label>
                <button
                  type="button"
                  onClick={() => openForm(rule)}
                  aria-label={`Edit rule ${rule.pattern}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule)}
                  disabled={busyId === rule.id}
                  aria-label={`Delete rule ${rule.pattern}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isFormOpen && (
        <RuleForm
          key={formRule?.id ?? "new"}
          rule={formRule}
          onSubmit={handleSubmit}
          onClose={() => setIsFormOpen(false)}
          isSaving={isSaving}
        />
      )}

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => !isApplying && setIsPreviewOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-black/10 bg-background p-5 shadow-xl dark:border-white/10"
          >
            <h2 className="text-base font-semibold">
              Change {changes.length} transaction{changes.length === 1 ? "" : "s"}?
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {scope === "all"
                ? "This re-files every transaction a rule matches, except ones you categorised by hand."
                : "Only transactions that are still Uncategorized will change."}{" "}
              Here are the first {Math.min(PREVIEW_ROWS, changes.length)}:
            </p>
            <ul className="mt-3 flex-1 divide-y divide-black/10 overflow-y-auto rounded-md border border-black/10 text-sm dark:divide-white/10 dark:border-white/10">
              {changes.slice(0, PREVIEW_ROWS).map((change) => (
                <li key={change.id} className="px-3 py-2">
                  <p className="truncate">{change.description}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {change.from} → <span className="font-medium text-zinc-700 dark:text-zinc-200">{change.to}</span>
                  </p>
                </li>
              ))}
            </ul>
            {changes.length > PREVIEW_ROWS && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                …and {changes.length - PREVIEW_ROWS} more.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                disabled={isApplying}
                className="min-h-[44px] flex-1 rounded-md border border-black/10 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleApply}
                disabled={isApplying}
                className="min-h-[44px] flex-1 rounded-md bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isApplying ? "Applying…" : `Apply to ${changes.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
