// Loading-state placeholders — shown instead of blank/empty content while
// data is still being fetched.

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div style={style} className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`} />;
}

export function SummaryCardsSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border border-black/10 p-3 sm:gap-4 sm:p-4 dark:border-white/10"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-16 sm:w-20" />
            <Skeleton className="mt-2 h-5 w-20 sm:h-6 sm:w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-64 flex-col gap-3 p-2 sm:h-80">
      <div className="flex flex-1 items-end gap-2">
        {[40, 65, 45, 80, 55, 70, 35].map((height, index) => (
          <Skeleton key={index} className="flex-1" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

export function BudgetCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="mt-4 flex flex-col items-center gap-2">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-32" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
