import AppShell from "../components/AppShell";
import TransactionsTable from "./TransactionsTable";

export default function Transactions() {
  return (
    <AppShell active="Transactions">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <TransactionsTable />
    </AppShell>
  );
}
