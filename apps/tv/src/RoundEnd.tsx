import React from "react";
import { HE, RoundEndPayload, PublicGameState } from "@gin-tv/shared";
import { Card } from "./Card";

interface Props {
  payload: RoundEndPayload;
  state: PublicGameState;
}

export function RoundEnd({ payload, state }: Props) {
  if (payload.reason === "cancelled") {
    return (
      <div className="overlay">
        <div className="result-card" style={{ textAlign: "center" }}>
          <h2 style={{ color: "var(--text-dim)" }}>{HE.roundCancelled}</h2>
          <div style={{ marginTop: 16, color: "var(--text-dim)" }}>
            לחצו {HE.readyNext} בנייד לסיבוב חדש
          </div>
        </div>
      </div>
    );
  }

  const winner = state.players.find((p) => p.id === payload.winner);
  const winnerName = winner?.name ?? "";

  return (
    <div className="overlay">
      <div className="result-card">
        <h2>
          {HE.winner}: {winnerName}{" "}
          {payload.reason === "gin" && <span style={{ color: "var(--gold-soft)" }}>· {HE.gin}!</span>}
          {payload.reason === "undercut" && <span style={{ color: "var(--danger)" }}>· {HE.undercut}</span>}
        </h2>
        <div className="points">+{payload.pointsAwarded} {HE.pointsGained}</div>
        <div style={{ marginTop: 8, color: "var(--text-dim)" }}>
          {HE.round}: {state.round} · {HE.target} {state.targetScore}
        </div>

        <div className="result-hands">
          {state.players.map((p) => {
            const hand = payload.hands[p.id] || [];
            const dead = payload.deadwood[p.id] ?? 0;
            return (
              <div key={p.id} className="hand-block">
                <h3>
                  {p.name}{" "}
                  <span className="dead-tag">{HE.deadwood}: {dead}</span>
                  <span style={{ color: "var(--gold-soft)", marginRight: 8 }}>
                    סך הכל: {payload.totals[p.id]}
                  </span>
                </h3>
                <div className="hand-row">
                  {hand.map((c) => (
                    <Card key={c.id} card={c} small />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 18, color: "var(--text-dim)", textAlign: "center" }}>
          {payload.matchOver ? HE.matchOver : `${HE.nextRound} — לחצו ${HE.readyNext} בנייד`}
        </div>
      </div>
    </div>
  );
}
