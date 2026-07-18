"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

// Wraps one reorderable dashboard section (Charts / Budget / Goals) with a
// shared header: a drag handle for desktop (native HTML5 drag, only
// initiated from the handle so clicks/selects inside the section's own
// content never accidentally start a drag) and up/down buttons for mobile,
// where drag-and-drop isn't practical. Summary cards aren't wrapped in this
// — they're intentionally fixed above the reorderable list.
export default function DashboardSection({
  title,
  isDragging,
  isDragOver,
  onDragStartHandle,
  onDragOver,
  onDrop,
  onDragEnd,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  children,
}: {
  title: string;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStartHandle: () => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(event);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={`group mt-8 rounded-lg transition-[opacity] ${isDragging ? "opacity-40" : ""} ${
        isDragOver ? "outline outline-2 outline-dashed outline-blue-400 outline-offset-4" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            // Firefox refuses to start a drag unless data is actually set —
            // the payload itself is unused since reordering is tracked in
            // React state, not read back out of dataTransfer on drop.
            event.dataTransfer.setData("text/plain", title);
            onDragStartHandle();
          }}
          onDragEnd={onDragEnd}
          aria-hidden="true"
          title="Drag to reorder"
          className="hidden shrink-0 cursor-grab select-none pr-0.5 text-lg leading-none text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing sm:block dark:text-zinc-500"
        >
          ⠿
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 sm:hidden">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${title} section up`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${title} section down`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {children}
    </section>
  );
}
