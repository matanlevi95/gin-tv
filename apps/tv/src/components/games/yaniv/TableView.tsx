import React from "react";
import { HE } from "@gin-tv/shared";
import { Card, CardBack } from "../../../Card";

interface Props {
  /** YanivPublic from shared. Typed loosely to avoid coupling here. */
  state: any;
}

export function YanivTableView({ state }: Props) {
  const [p1, p2] = state.players;
  const currentName =
    state.players.find((pp: any) => pp.id === state.currentTurn)?.name ?? "";
  const lastGroup: any[] = state.lastDiscardGroup || [];
  const lowDeck = state.deckCount > 0 && state.deckCount < 6;
  return (
    <>
      <div className="corner top-right">
        <h3>{HE.roomCode}</h3>
        <div className="big">{state.roomCode}</div>
        <div style={{ marginTop: 12, color: "var(--text-dim)", fontSize: 14 }}>
          {HE.round} {state.round} · יעד {state.targetScore}
        </div>
      </div>

      <div className="corner top-left">
        <h3>שחקנים (יניב)</h3>
        {state.players.map((p: any) => (
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

      {p2 && <YanivPlayerStrip name={p2.name} cardCount={p2.handCount} position="top" isTurn={state.currentTurn === p2.id} />}
      {p1 && <YanivPlayerStrip name={p1.name} cardCount={p1.handCount} position="bottom" isTurn={state.currentTurn === p1.id} />}

      <div className="center-play">
        <div className="deck-spot">
          <div className={`deck-stack ${lowDeck ? "low" : ""}`}>
            {state.deckCount > 0 && <CardBack />}
            {state.deckCount > 1 && <CardBack />}
            {state.deckCount > 2 && <CardBack />}
          </div>
          <div className="label">{HE.pile}</div>
          <div className="deck-count">{state.deckCount}</div>
        </div>

        <div className="discard-spot" style={{ display: "flex", gap: 8 }}>
          {lastGroup.length === 0 ? (
            <div className="card" style={{ visibility: "hidden" }} />
          ) : (
            lastGroup.map((c: any) => <Card key={c.id} card={c} />)
          )}
        </div>
      </div>

      {state.currentTurn && (
        <div className="turn-banner glow">
          ▸ {currentName} — {state.turnPhase === "discard" ? "זרוק או הכרז יניב" : "קח קלף"}
        </div>
      )}
    </>
  );
}

function YanivPlayerStrip({
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
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <div key={i} className="deal-in" style={{ marginLeft: -28, animationDelay: `${0.05 * i}s` }}>
            <CardBack />
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
        {isTurn ? "▸ " : ""}{name} · {cardCount} קלפים
      </div>
    </div>
  );
}
