import React, { useEffect, useRef, useState } from "react";
import { HE, PublicGameState } from "@gin-tv/shared";
import { Card, CardBack } from "../../../Card";

interface Props {
  state: PublicGameState;
  message?: string;
}

/** Rolling log of the last few server-emitted actions, formatted for the TV side panel. */
function useMoveLog(state: PublicGameState) {
  const [log, setLog] = useState<{ id: number; text: string; at: number }[]>([]);
  const lastAt = useRef(0);
  const idRef = useRef(0);
  useEffect(() => {
    const at = state.lastAction?.at ?? 0;
    if (!at || at === lastAt.current) return;
    lastAt.current = at;
    const a = state.lastAction;
    if (!a) return;
    const byName = state.players.find((p) => p.id === a.by)?.name ?? "";
    let text = "";
    switch (a.kind) {
      case "deal":
        text = "חלוקה חדשה";
        break;
      case "draw_deck":
        text = `${byName} לקח מהקופה`;
        break;
      case "draw_discard":
        text = `${byName} לקח מהזריקה`;
        break;
      case "discard":
        text = `${byName} זרק קלף`;
        break;
      case "knock":
        text = `${byName} הכריז נקישה`;
        break;
      case "gin":
        text = `${byName} ג׳ין!`;
        break;
      case "undercut":
        text = `${byName} עשה אנדרקאט!`;
        break;
      default:
        return;
    }
    setLog((prev) => [{ id: ++idRef.current, text, at }, ...prev].slice(0, 5));
  }, [state.lastAction, state.players]);
  return log;
}

/** Score number that briefly animates with a pop when its value changes. */
function ScoreBadge({ score }: { score: number }) {
  const [pop, setPop] = useState(false);
  const prev = useRef(score);
  useEffect(() => {
    if (prev.current !== score) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 600);
      prev.current = score;
      return () => clearTimeout(t);
    }
  }, [score]);
  return (
    <span className={`badge-score ${pop ? "score-tick" : ""}`}>{score}</span>
  );
}

/** Tracks the last-action timestamp; returns true for ~400ms after a deck draw. */
function useDeckJitter(state: PublicGameState) {
  const [shake, setShake] = useState(false);
  const lastAt = useRef(0);
  useEffect(() => {
    const at = state.lastAction?.at ?? 0;
    if (at && at !== lastAt.current && state.lastAction?.kind === "draw_deck") {
      setShake(true);
      const t = setTimeout(() => setShake(false), 400);
      lastAt.current = at;
      return () => clearTimeout(t);
    }
    if (at) lastAt.current = at;
  }, [state.lastAction]);
  return shake;
}

/** True for ~400ms after a discard action lands. */
function useDiscardPop(state: PublicGameState) {
  const [pop, setPop] = useState(false);
  const lastAt = useRef(0);
  useEffect(() => {
    const at = state.lastAction?.at ?? 0;
    if (
      at &&
      at !== lastAt.current &&
      (state.lastAction?.kind === "discard" ||
        state.lastAction?.kind === "knock" ||
        state.lastAction?.kind === "gin")
    ) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 400);
      lastAt.current = at;
      return () => clearTimeout(t);
    }
    if (at) lastAt.current = at;
  }, [state.lastAction]);
  return pop;
}

export function TableView({ state, message }: Props) {
  const [p1, p2] = state.players;
  const currentName =
    state.players.find((pp) => pp.id === state.currentTurn)?.name ?? "";
  const deckShake = useDeckJitter(state);
  const discardPop = useDiscardPop(state);
  const lowDeck = state.deckCount > 0 && state.deckCount < 8;
  const moveLog = useMoveLog(state);

  return (
    <>
      {/* Top-right corner: room code + recent moves */}
      <div className="corner top-right">
        <h3>{HE.roomCode}</h3>
        <div className="big">{state.roomCode}</div>
        <div style={{ marginTop: 12, color: "var(--text-dim)", fontSize: 14 }}>
          {HE.round} {state.round} · {HE.target} {state.targetScore}
        </div>
        {moveLog.length > 0 && (
          <div style={{ marginTop: 18, borderTop: "1px solid rgba(212,168,91,0.15)", paddingTop: 10 }}>
            <h3>מהלכים אחרונים</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {moveLog.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    color: i === 0 ? "var(--gold-soft)" : "var(--text-dim)",
                    fontSize: i === 0 ? 16 : 13,
                    fontWeight: i === 0 ? 700 : 400,
                  }}
                >
                  {m.text}
                </div>
              ))}
            </div>
          </div>
        )}
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
            <ScoreBadge score={p.score} />
          </div>
        ))}
      </div>

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
          <div className={`deck-stack ${deckShake ? "drew" : ""} ${lowDeck ? "low" : ""}`}>
            {state.deckCount > 0 && <CardBack />}
            {state.deckCount > 1 && <CardBack />}
            {state.deckCount > 2 && <CardBack />}
          </div>
          <div className="label">{HE.pile}</div>
          <div className="deck-count">{state.deckCount}</div>
        </div>

        <div className="discard-spot">
          {/* underlay cards to show the pile has depth */}
          {state.discardCount > 1 && <div className="pile-underlay u1" />}
          {state.discardCount > 2 && <div className="pile-underlay u2" />}
          {state.discardCount > 3 && <div className="pile-underlay u3" />}
          {state.discardTop ? (
            <Card card={{ ...state.discardTop }} small={false} />
          ) : (
            <div className="card" style={{ visibility: "hidden" }} />
          )}
          {discardPop && state.discardTop && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                animation: "pileReceive 0.4s ease-out",
              }}
            />
          )}
          <div className="label">{HE.discardPile}</div>
          <div className="deck-count">{state.discardCount}</div>
        </div>
      </div>

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
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className="deal-in"
            style={{
              marginLeft: -34,
              animationDelay: `${0.04 * i}s`,
            }}
          >
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
