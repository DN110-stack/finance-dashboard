"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Loader2, Receipt, RefreshCw, Settings, Target, Wallet } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import SignOutButton from "./SignOutButton";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Budget", href: "/budget", icon: Wallet },
  { label: "Goals", href: "#", icon: Target },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Distance (px) the user has to pull down past the top of the scroll
// container before releasing triggers a refresh, and the max the indicator
// is allowed to travel while pulling (further pulling has no extra effect).
const PULL_TRIGGER_PX = 64;
const PULL_MAX_PX = 96;

export default function AppShell({
  active,
  children,
  enablePullToRefresh = false,
}: {
  active: string;
  children: React.ReactNode;
  enablePullToRefresh?: boolean;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Mirrors touchStartY !== null, but as state — render needs to know
  // whether a touch is in progress (to skip the snap-back transition), and
  // refs can't be read during render.
  const [isTouching, setIsTouching] = useState(false);

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (!enablePullToRefresh || isRefreshing) return;
    if ((mainRef.current?.scrollTop ?? 0) > 0) {
      touchStartY.current = null;
      return;
    }
    touchStartY.current = event.touches[0].clientY;
    setIsTouching(true);
  }

  function handleTouchMove(event: React.TouchEvent<HTMLElement>) {
    if (touchStartY.current === null || isRefreshing) return;
    const delta = event.touches[0].clientY - touchStartY.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }
    // Resistance curve — the indicator slows down the further it's dragged.
    setPullDistance(Math.min(delta * 0.5, PULL_MAX_PX));
  }

  function handleTouchEnd() {
    setIsTouching(false);
    if (touchStartY.current === null || isRefreshing) return;
    touchStartY.current = null;
    if (pullDistance >= PULL_TRIGGER_PX) {
      setIsRefreshing(true);
      window.location.reload();
    } else {
      setPullDistance(0);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-black/10 px-4 sm:h-16 sm:px-6 dark:border-white/10">
        <span className="text-base font-semibold sm:text-lg">Finance Dashboard</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 flex-col border-r border-black/10 p-4 md:flex dark:border-white/10">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.label === active;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white ${
                    isActive
                      ? "bg-black/5 text-zinc-900 dark:bg-white/10 dark:text-white"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main
          ref={mainRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 sm:p-6 md:pb-6"
        >
          {enablePullToRefresh && (pullDistance > 0 || isRefreshing) && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center text-zinc-400 dark:text-zinc-500"
              style={{ height: PULL_MAX_PX, marginTop: -PULL_MAX_PX + pullDistance }}
            >
              {isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw
                  className="h-5 w-5 transition-transform"
                  style={{
                    transform: `rotate(${Math.min((pullDistance / PULL_TRIGGER_PX) * 180, 180)}deg)`,
                  }}
                />
              )}
            </div>
          )}
          <div
            style={{
              transform: pullDistance > 0 || isRefreshing ? `translateY(${pullDistance}px)` : undefined,
              transition: isTouching ? undefined : "transform 0.2s ease-out",
            }}
          >
            {children}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-black/10 bg-background pb-[env(safe-area-inset-bottom)] md:hidden dark:border-white/10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.label === active;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors hover:text-zinc-900 dark:hover:text-white ${
                isActive
                  ? "text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
