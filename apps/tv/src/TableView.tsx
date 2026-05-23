import React from "react";
import { HE, PublicGameState } from "@gin-tv/shared";
import { Card, CardBack } from "./Card";

interface Props {
  state: PublicGameState;
  message?: string;
}

export function TableView({ state, message }: Props) {
  const [p1, p2] = state.players;
  const currentName =
    state.players.find((pp) => pp.id === state.currentTurn)?.name ?? "";

  return (
    <>
      {/* Top-right corner: room code (for late joins/reconnect) */}
      <div className="corner top-right">
        <h3>{HE.roomCode}</h3>
        <div className="big">{state.roomCode}</div>
        <div style={{ marginTop: 12, color: "var(--text-dim)", fontSize: 14 }}>
          {HE.round} {state.round} · {HE.target} {state.targetScore}
        </div>
      </div>

      {/* Top-left corner: scores */}
      <div className="corner top-left">
        <h3>{HE.players}</h3>
        {state.players.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
              marginTop: 6,
              fontSize: 20,
              fontWeight: 700,
              color: p.id === state.currentTurn ? "var(--gold-soft)" : "var(--text)",
            }}
          >
            <span>
              {p.id === state.currentTurn ? "▸ " : ""}
              {p.name}
            </span>
            <span className="badge-score">{p.score}</span>
          </div>
        ))}
      </div>

      {/* Opponent (top player) - face-down hand strip */}
      {p2 && (
        <PlayerStrip
          name={p2.name}
          cardCount={p2.handCount}
          position="top"
          isTurn={state.currentTurn === p2.id}
        />
      )}
      {p1 && (
        <PlayerStrip
          name={p1.name}
          cardCount={p1.handCount}
          position="bottom"
          isTurn={state.currentTurn === p1.id}
        />
      )}

      {/* Center play area */}
      <div className="center-play">
        <div className="deck-spot">
          <div className="deck-stack">
            {state.deckCount > 0 && <CardBack />}
            {state.deckCount > 1 && <CardBack />}
            {state.deckCount > 2 && <CardBack />}
          </div>
          <div className="label">{HE.pile}</div>
          <div className="deck-count">{state.deckCount}</div>
        </div>

        <div className="discard-spot">
          {state.discardTop ? <Card card={state.discardTop} /> : (
            <div className="card" style={{ visibility: "hidden" }} />
          )}
          <div className="label">{HE.discardPile}</div>
          <div className="deck-count">{state.discardCount}</div>
        </div>
      </div>

      {/* Turn banner */}
      {state.currentTurn && (
        <div className={`turn-banner glow`}>
          ▸ {currentName} — {HE.yourTurn}
        </div>
      )}

      {message && <div className="message">{message}</div>}
    </>
  );
}

function PlayerStrip({
  name,
  cardCount,
  position,
  isTurn,
}: {
  name: string;
  cardCount: number;
  position: "top" | "bottom";
  isTurn: boolean;
}) {
  const styles: React.CSSProperties =
    position === "top"
      ? { top: 110, right: "50%", transform: "translateX(50%)" }
      : { bottom: 110, right: "50%", transform: "translateX(50%)" };
  return (
    <div style={{ position: "absolute", ...styles }}>
      <div
        style={{
          display: "flex",
          gap: -34 as any,
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <div key={i} style={{ marginLeft: -34 }}>
            <CardBack small />
          </div>
        ))}
      </div>
      <div
        style={{
          textAlign: "center",
          fontWeight: 700,
          fontSize: 18,
          color: isTurn ? "var(--gold-soft)" : "var(--text-dim)",
          textShadow: isTurn ? "0 0 12px rgba(255,209,102,0.6)" : "none",
        }}
      >
        {isTurn ? "▸ " : ""}{name} · {cardCount} {HE.cards}
      </div>
    </div>
  );
}
