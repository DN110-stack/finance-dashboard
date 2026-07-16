import { donutStrokeColour } from "../lib/budgets";

const DEFAULT_SIZE = 80;
const DEFAULT_STROKE = 8;

// A single-ratio-against-a-limit meter (percent of budget used), not a pie —
// same green/amber/red thresholds as the linear progress bar it replaces
// (see donutStrokeColour), with a neutral track so state reads at a glance.
export default function DonutMeter({
  percent,
  ready,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE,
}: {
  percent: number;
  // Mirrors the existing barsReady pattern — the ring animates in from empty
  // once, rather than snapping straight to its target on mount.
  ready: boolean;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const offset = ready ? circumference * (1 - clampedPercent / 100) : circumference;
  const center = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-black/10 dark:stroke-white/10"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${donutStrokeColour(percent)} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-zinc-900 dark:text-white">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}
