import AppShell from "../components/AppShell";
import BudgetManager from "./BudgetManager";

export default function BudgetPage() {
  return (
    <AppShell active="Budget">
      <h1 className="text-2xl font-semibold">Budget</h1>
      <BudgetManager />
    </AppShell>
  );
}
