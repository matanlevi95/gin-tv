import React, { useMemo } from "react";

/** A burst of falling confetti for match-end. Pure CSS animation, no deps. */
export function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() => {
    const colors = ["#d4a85b", "#f3d792", "#4caf6d", "#c8553d", "#fff2c7"];
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100;
      const xDrift = (Math.random() - 0.5) * 200;
      const delay = Math.random() * 1.2;
      const duration = 2.5 + Math.random() * 2.0;
      const rotate = Math.random() * 360;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const width = 6 + Math.random() * 10;
      const height = 10 + Math.random() * 12;
      return { i, left, xDrift, delay, duration, rotate, color, width, height };
    });
  }, [count]);

  return (
    <div className="match-end-confetti" aria-hidden>
      {pieces.map((p) => (
        <div
          key={p.i}
          className="piece"
          style={
            {
              left: `${p.left}%`,
              backgroundColor: p.color,
              width: `${p.width}px`,
              height: `${p.height}px`,
              transform: `rotate(${p.rotate}deg)`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--x" as any]: `${p.xDrift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
