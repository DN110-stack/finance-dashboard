import { Plus } from "lucide-react";

// bottom-20 on mobile clears AppShell's fixed bottom nav bar (hidden from
// md: up, where bottom-6 applies instead). z-40 keeps it under
// DrillDownPanel's z-50 backdrop/panel.
export default function FloatingAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-6 bottom-20 z-40 flex min-h-[44px] items-center gap-2 rounded-full bg-blue-600 px-5 py-3.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl md:bottom-6"
    >
      <Plus className="h-5 w-5" />
      {label}
    </button>
  );
}
