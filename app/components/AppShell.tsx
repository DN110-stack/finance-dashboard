import Link from "next/link";
import { LayoutDashboard, Receipt, Tag, Target, Wallet } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import SignOutButton from "./SignOutButton";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Categories", href: "/categories", icon: Tag },
  { label: "Budget", href: "#", icon: Wallet },
  { label: "Goals", href: "#", icon: Target },
];

export default function AppShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
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
        <aside className="hidden w-56 flex-col border-r border-black/10 p-4 sm:flex dark:border-white/10">
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

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>

      <nav className="flex items-center justify-around border-t border-black/10 bg-background py-2 sm:hidden dark:border-white/10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.label === active;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors hover:text-zinc-900 dark:hover:text-white ${
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
