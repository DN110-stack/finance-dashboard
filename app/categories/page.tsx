import AppShell from "../components/AppShell";
import CategoriesManager from "./CategoriesManager";

export default function CategoriesPage() {
  return (
    <AppShell active="Categories">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <CategoriesManager />
    </AppShell>
  );
}
