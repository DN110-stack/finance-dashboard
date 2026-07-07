import AppShell from "./components/AppShell";
import SummaryCards from "./components/SummaryCards";
import SpendingChart from "./components/SpendingChart";
import MonthlyCategoryChart from "./components/MonthlyCategoryChart";
import ChatPanel from "./components/ChatPanel";

export default function Home() {
  return (
    <AppShell active="Dashboard">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <SummaryCards />

      <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Spending</h2>
        <div className="mt-4 h-64 sm:h-80">
          <SpendingChart />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Monthly Expenses by Category</h2>
        <div className="mt-4 h-64 sm:h-80">
          <MonthlyCategoryChart />
        </div>
      </div>

      <ChatPanel />
    </AppShell>
  );
}
