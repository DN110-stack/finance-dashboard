export default function EmptyChartState({ message }: { message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
      <p>{message ?? "No data for this period."}</p>
    </div>
  );
}
