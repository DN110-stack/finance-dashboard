"use client";

const PIECE_COLOURS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const PIECE_COUNT = 24;

// Deterministic pseudo-random in [0, 1) from an integer seed — used instead
// of Math.random so each piece's layout is a pure function of its index
// (Math.random/Date.now etc. aren't allowed during render under this repo's
// react-hooks/purity rule, even memoized).
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const PIECES = Array.from({ length: PIECE_COUNT }).map((_, index) => ({
  id: index,
  left: pseudoRandom(index) * 100,
  delay: pseudoRandom(index + 100) * 0.3,
  duration: 1.1 + pseudoRandom(index + 200) * 0.6,
  colour: PIECE_COLOURS[index % PIECE_COLOURS.length],
  rotation: pseudoRandom(index + 300) * 360,
  drift: (pseudoRandom(index + 400) - 0.5) * 40,
}));

// A one-shot confetti burst over whatever it's rendered inside — pieces fall
// via a CSS keyframe (see globals.css) and the whole overlay is meant to be
// unmounted by the caller a couple seconds after it appears, since it never
// resets or loops itself.
export default function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl" aria-hidden="true">
      {PIECES.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 h-2 w-1.5 animate-[confetti-fall_var(--fall-duration)_ease-in_var(--fall-delay)_forwards]"
          style={
            {
              left: `${piece.left}%`,
              backgroundColor: piece.colour,
              "--fall-duration": `${piece.duration}s`,
              "--fall-delay": `${piece.delay}s`,
              "--fall-rotation": `${piece.rotation}deg`,
              "--fall-drift": `${piece.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
