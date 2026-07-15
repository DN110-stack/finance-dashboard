// A minimal inline trend line — no axes or labels, just shape. Colour stays
// neutral ("currentColor" via the ink/muted text classes callers pass in)
// since this encodes a magnitude trend, not category identity; identity is
// already carried by the swatch next to it.
const WIDTH = 56;
const HEIGHT = 20;

export default function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const max = Math.max(...values, 0.01);
  const stepX = WIDTH / (values.length - 1);
  const points = values.map((value, index) => {
    const x = index * stepX;
    const y = HEIGHT - (value / max) * (HEIGHT - 4) - 2;
    return { x, y };
  });

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="shrink-0 text-zinc-400 dark:text-zinc-500"
      aria-hidden="true"
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, index) => (
        <circle
          key={index}
          cx={p.x}
          cy={p.y}
          r={index === points.length - 1 ? 2 : 1.25}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
