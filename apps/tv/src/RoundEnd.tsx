import React from "react";
import { HE, RoundEndPayload, PublicGameState } from "@gin-tv/shared";
import { Card } from "./Card";
import { Confetti } from "./Confetti";

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

  const overlayClass =
    payload.reason === "gin" ? "overlay gin" :
    payload.reason === "knock" ? "overlay knock" :
    payload.reason === "undercut" ? "overlay undercut" :
    "overlay";

  return (
    <div className={overlayClass}>
      {payload.matchOver && <Confetti count={120} />}
      <div className="result-card">
        <h2>
          {HE.winner}: {winnerName}{" "}
          {payload.reason === "gin" && <span style={{ color: "var(--gold-soft)" }}>· {HE.gin}!</span>}
          {payload.reason === "undercut" && <span style={{ color: "var(--danger)" }}>· {HE.undercut}</span>}
        </h2>
        <div className="points">+{payload.pointsAwarded} {HE.pointsGained}</div>
        {payload.bonuses && (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
            <div className="bonus-chip">
              <span>{HE.gameBonusLabel}</span> <b>+{payload.bonuses.gameBonus}</b>
            </div>
            {payload.bonuses.shutoutBonus > 0 && (
              <div className="bonus-chip danger">
                <span>{HE.shutoutBonusLabel}</span> <b>+{payload.bonuses.shutoutBonus}</b>
              </div>
            )}
          </div>
        )}
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

        <div style={{ marginTop: 18, color: payload.matchOver ? "var(--gold)" : "var(--text-dim)", textAlign: "center", fontSize: payload.matchOver ? 22 : 14, fontWeight: payload.matchOver ? 800 : 400 }}>
          {payload.matchOver ? `🏆 ${HE.matchWinner}: ${winnerName}` : `${HE.nextRound} — לחצו ${HE.readyNext} בנייד`}
        </div>
      </div>
    </div>
  );
}
