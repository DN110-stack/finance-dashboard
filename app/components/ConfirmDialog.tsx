"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  // Styles the confirm button red — for deletes and other hard-to-undo actions.
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// In-app replacement for window.confirm — some browsers (embedded ones
// especially) block native dialogs, which made saves silently do nothing.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // A second request while one is open cancels the first.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setPending(options);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    if (!pending) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") settle(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => settle(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-black/10 bg-background p-5 shadow-xl dark:border-white/10"
          >
            <h2 id="confirm-dialog-title" className="text-base font-semibold">
              {pending.title ?? "Are you sure?"}
            </h2>
            <p id="confirm-dialog-message" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {pending.message}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="min-h-[44px] flex-1 rounded-md border border-black/10 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`min-h-[44px] flex-1 rounded-md text-sm font-medium text-white transition-colors ${
                  pending.destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
