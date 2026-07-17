import AppShell from "./components/AppShell";
import DashboardContent from "./components/DashboardContent";

export default function Home() {
  return (
    <AppShell active="Dashboard" enablePullToRefresh>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <DashboardContent />
    </AppShell>
  );
}
