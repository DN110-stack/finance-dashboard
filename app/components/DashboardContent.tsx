"use client";

import { useState, useSyncExternalStore } from "react";
import SummaryCards from "./SummaryCards";
import ChatPanel from "./ChatPanel";
import PeriodSelector from "./PeriodSelector";
import ChartsSection from "./ChartsSection";
import BudgetWidget from "./BudgetWidget";
import GoalsWidget from "./GoalsWidget";
import DashboardSection from "./DashboardSection";
import { DEFAULT_PERIOD, getPeriodRange, type PeriodState } from "../lib/period";
import {
  dashboardLayoutStore,
  moveSection,
  reorderSections,
  type DashboardSectionId,
} from "../lib/dashboardLayout";

const SECTION_TITLES: Record<DashboardSectionId, string> = {
  charts: "Charts",
  budgets: "Budget",
  goals: "Goals",
};

export default function DashboardContent() {
  const [period, setPeriod] = useState<PeriodState>(DEFAULT_PERIOD);
  const order = useSyncExternalStore(
    dashboardLayoutStore.subscribe,
    dashboardLayoutStore.getSnapshot,
    dashboardLayoutStore.getServerSnapshot
  );
  const isCustomIncomplete = period.option === "custom" && !getPeriodRange(period);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      dashboardLayoutStore.set(reorderSections(order, dragIndex, targetIndex));
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleMove(index: number, direction: -1 | 1) {
    dashboardLayoutStore.set(moveSection(order, index, direction));
  }

  return (
    <>
      <div className="mt-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {isCustomIncomplete && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Choose both a from and to date to see this period.
          </p>
        )}
      </div>

      <SummaryCards period={period} />

      {order.map((sectionId, index) => (
        <DashboardSection
          key={sectionId}
          title={SECTION_TITLES[sectionId]}
          isDragging={dragIndex === index}
          isDragOver={dragOverIndex === index && dragIndex !== null && dragIndex !== index}
          onDragStartHandle={() => setDragIndex(index)}
          onDragOver={() => setDragOverIndex(index)}
          onDrop={() => handleDrop(index)}
          onDragEnd={() => {
            setDragIndex(null);
            setDragOverIndex(null);
          }}
          canMoveUp={index > 0}
          canMoveDown={index < order.length - 1}
          onMoveUp={() => handleMove(index, -1)}
          onMoveDown={() => handleMove(index, 1)}
        >
          {sectionId === "charts" && <ChartsSection period={period} />}
          {sectionId === "budgets" && <BudgetWidget />}
          {sectionId === "goals" && <GoalsWidget />}
        </DashboardSection>
      ))}

      <ChatPanel />
    </>
  );
}
