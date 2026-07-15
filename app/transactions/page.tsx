import AppShell from "../components/AppShell";
import TransactionsTabs from "./TransactionsTabs";

export default function Transactions() {
  return (
    <AppShell active="Transactions">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <TransactionsTabs />
    </AppShell>
  );
}
