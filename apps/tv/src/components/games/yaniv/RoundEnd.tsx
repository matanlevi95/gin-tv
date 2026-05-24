import React from "react";
import { HE } from "@gin-tv/shared";
import { Card } from "../../../Card";
import { Confetti } from "../../../Confetti";

export function YanivRoundEnd({ payload, state }: { payload: any; state: any }) {
  // The Gin-shaped RoundEndPayload comes with `yaniv` side-channel attached.
  const y = payload.yaniv as any;
  const callerName = state.players.find((p: any) => p.id === y?.caller)?.name ?? "";
  const winnerName = state.players.find((p: any) => p.id === y?.winner)?.name ?? "";
  const isAssaf = y?.reason === "assaf";
  return (
    <div className={`overlay ${isAssaf ? "undercut" : "knock"}`}>
      {payload.matchOver && <Confetti count={120} />}
      <div className="result-card">
        <h2>
          {isAssaf ? (
            <>
              <span style={{ color: "var(--danger)" }}>אסף!</span> {winnerName} פגע ב{callerName}
            </>
          ) : (
            <>
              <span style={{ color: "var(--gold-soft)" }}>יניב!</span> {callerName} ניצח
            </>
          )}
        </h2>
        <div className="points">
          {isAssaf ? `+${y?.pointsAwarded?.[y?.caller] ?? 0} ל${callerName}` : `+${y?.pointsAwarded?.[y?.winner === y?.caller ? state.players.find((pp: any) => pp.id !== y.caller)?.id : y?.caller] ?? 0}`}
        </div>

        <div className="result-hands">
          {state.players.map((p: any) => {
            const hand = y?.hands?.[p.id] ?? [];
            const v = y?.handValues?.[p.id] ?? 0;
            return (
              <div key={p.id} className="hand-block">
                <h3>
                  {p.name}{" "}
                  <span className="dead-tag">ערך יד: {v}</span>
                  <span style={{ color: "var(--gold-soft)", marginRight: 8 }}>
                    סך הכל: {y?.totals?.[p.id]}
                  </span>
                </h3>
                <div className="hand-row">
                  {hand.map((c: any) => (
                    <Card key={c.id} card={c} small />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 18,
            color: payload.matchOver ? "var(--gold)" : "var(--text-dim)",
            textAlign: "center",
            fontSize: payload.matchOver ? 22 : 14,
            fontWeight: payload.matchOver ? 800 : 400,
          }}
        >
          {payload.matchOver
            ? `🏆 ניצח במשחק: ${winnerName}`
            : `סבב חדש — לחצו ${HE.readyNext} בנייד`}
        </div>
      </div>
    </div>
  );
}
