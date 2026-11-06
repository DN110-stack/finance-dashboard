import AppShell from "../components/AppShell";
import BillsManager from "./BillsManager";

export default function BillsPage() {
  return (
    <AppShell active="Bills">
      <h1 className="text-2xl font-semibold">Bills</h1>
      <BillsManager />
    </AppShell>
  );
}
