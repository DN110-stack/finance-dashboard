import AppShell from "../components/AppShell";
import SettingsForm from "./SettingsForm";

export default function SettingsPage() {
  return (
    <AppShell active="Settings">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm />
    </AppShell>
  );
}
