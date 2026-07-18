import AppShell from "../components/AppShell";
import GoalsManager from "./GoalsManager";

export default function GoalsPage() {
  return (
    <AppShell active="Goals">
      <h1 className="text-2xl font-semibold">Goals</h1>
      <GoalsManager />
    </AppShell>
  );
}
