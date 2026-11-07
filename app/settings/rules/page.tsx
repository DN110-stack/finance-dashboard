import AppShell from "../../components/AppShell";
import RulesManager from "./RulesManager";

export default function RulesPage() {
  return (
    <AppShell active="Settings">
      <h1 className="text-2xl font-semibold">Categorisation rules</h1>
      <RulesManager />
    </AppShell>
  );
}
