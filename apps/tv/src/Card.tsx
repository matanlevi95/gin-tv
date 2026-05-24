import React from "react";
import type { Card as CardT, Rank, Suit } from "@gin-tv/shared";

const SUIT_PATH: Record<Suit, string> = {
  // Solid, high-contrast SVG glyphs sized for a viewBox of 32x32.
  S: "M16 2 C 22 10, 30 14, 30 22 C 30 27, 26 30, 22 30 C 19 30, 17 28, 16 26 C 15 28, 13 30, 10 30 C 6 30, 2 27, 2 22 C 2 14, 10 10, 16 2 Z M14 26 L 12 32 L 20 32 L 18 26 Z",
  H: "M16 30 C 16 30, 2 20, 2 11 C 2 6, 6 3, 10 3 C 13 3, 15 5, 16 8 C 17 5, 19 3, 22 3 C 26 3, 30 6, 30 11 C 30 20, 16 30, 16 30 Z",
  D: "M16 1 L 30 16 L 16 31 L 2 16 Z",
  C: "M16 2 C 12 2, 10 5, 10 8 C 10 10, 11 12, 13 13 C 9 13, 6 16, 6 20 C 6 24, 9 27, 13 27 C 15 27, 16 26, 16 26 C 16 26, 14 30, 12 32 L 20 32 C 18 30, 16 26, 16 26 C 16 26, 17 27, 19 27 C 23 27, 26 24, 26 20 C 26 16, 23 13, 19 13 C 21 12, 22 10, 22 8 C 22 5, 20 2, 16 2 Z",
};

const SUIT_RED: Record<Suit, boolean> = { S: false, H: true, D: true, C: false };

/** Tiny suit symbol shown in the corner above the rank. */
function SuitSvg({ suit, size = 18, color }: { suit: Suit; size?: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: "block" }}
      aria-hidden
    >
      <path d={SUIT_PATH[suit]} fill={color} />
    </svg>
  );
}

/** Big centered suit pip array — number of pips matches the rank for 2..10. */
function CenterPips({ rank, suit, color, size }: { rank: Rank; suit: Suit; color: string; size: "sm" | "md" | "lg" }) {
  // For face cards and A, just show one large glyph in the middle.
  if (rank === "A" || rank === "J" || rank === "Q" || rank === "K") {
    const big = size === "lg" ? 64 : size === "md" ? 44 : 26;
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <SuitSvg suit={suit} size={big} color={color} />
      </div>
    );
  }
  const n = parseInt(rank, 10);
  const layouts: Record<number, [number, number][]> = {
    2: [[0.5, 0.25], [0.5, 0.75]],
    3: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
    4: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.75], [0.7, 0.75]],
    5: [[0.3, 0.25], [0.7, 0.25], [0.5, 0.5], [0.3, 0.75], [0.7, 0.75]],
    6: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    7: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    8: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.32], [0.3, 0.5], [0.7, 0.5], [0.5, 0.68], [0.3, 0.8], [0.7, 0.8]],
    9: [[0.3, 0.18], [0.7, 0.18], [0.3, 0.38], [0.7, 0.38], [0.5, 0.5], [0.3, 0.62], [0.7, 0.62], [0.3, 0.82], [0.7, 0.82]],
    10: [[0.3, 0.15], [0.7, 0.15], [0.3, 0.32], [0.7, 0.32], [0.5, 0.24], [0.5, 0.76], [0.3, 0.68], [0.7, 0.68], [0.3, 0.85], [0.7, 0.85]],
  };
  const positions = layouts[n] || [];
  const pip = size === "lg" ? 20 : size === "md" ? 14 : 9;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "12% 18%" }}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {positions.map(([x, y], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: `translate(-50%, -50%) ${y > 0.5 ? "rotate(180deg)" : ""}`,
            }}
          >
            <SuitSvg suit={suit} size={pip} color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Card({ card, small }: { card: CardT; small?: boolean }) {
  const red = SUIT_RED[card.suit];
  const color = red ? "#b73020" : "#1a1a1a";
  const size = small ? "sm" : "md";
  const cornerFs = small ? 12 : 20;
  const cornerSuit = small ? 11 : 16;
  return (
    <div className={`card ${red ? "red" : "black"} ${small ? "small" : ""}`}>
      <div className="corner-top">
        <span style={{ fontSize: cornerFs, color }}>{card.rank}</span>
        <SuitSvg suit={card.suit} size={cornerSuit} color={color} />
      </div>
      <CenterPips rank={card.rank} suit={card.suit} color={color} size={size} />
      <div className="corner-bot">
        <span style={{ fontSize: cornerFs, color }}>{card.rank}</span>
        <SuitSvg suit={card.suit} size={cornerSuit} color={color} />
      </div>
    </div>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card back ${small ? "small" : ""}`} />;
}
