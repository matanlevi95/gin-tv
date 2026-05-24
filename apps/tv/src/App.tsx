import React, { useEffect, useState } from "react";
import { HE, encodeJoinUrl, PROTOCOL_VERSION, GameType } from "@gin-tv/shared";
import { Lobby } from "./Lobby";
import { TableView as GinTableView } from "./components/games/gin/TableView";
import { RoundEnd as GinRoundEnd } from "./components/games/gin/RoundEnd";
import { YanivTableView } from "./components/games/yaniv/TableView";
import { YanivRoundEnd } from "./components/games/yaniv/RoundEnd";
import { useRoomHost } from "./useRoomHost";
import { SUPABASE_ANON_PUBLIC, SUPABASE_URL_PUBLIC } from "./supabase";
import { MuteButton } from "./MuteButton";

const GAME_STORAGE_KEY = "ginTv:tvGame";

function readSavedGame(): GameType | null {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(GAME_STORAGE_KEY) : null;
    if (v === "gin" || v === "yaniv") return v;
  } catch {}
  return null;
}

function GamePicker({ onPick }: { onPick: (g: GameType) => void }) {
  return (
    <div className="lobby">
      <div className="title">
        <span className="accent">TV</span> משחקים
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: 22, marginBottom: 12 }}>בחר משחק לחדר</div>
      <div style={{ display: "flex", gap: 28 }}>
        <GameTile label="ג׳ין רמי" subtitle="2 שחקנים · 10 קלפים" onClick={() => onPick("gin")} accent="#d4a85b" />
        <GameTile label="יניב" subtitle="2 שחקנים · 5 קלפים" onClick={() => onPick("yaniv")} accent="#4caf6d" />
      </div>
    </div>
  );
}

function GameTile({
  label,
  subtitle,
  onClick,
  accent,
}: {
  label: string;
  subtitle: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--panel)",
        border: `2px solid ${accent}`,
        borderRadius: 24,
        padding: "32px 48px",
        color: "var(--text)",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: `0 18px 60px ${accent}40`,
        transition: "transform 0.2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-6px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div style={{ fontSize: 44, fontWeight: 900, color: accent }}>{label}</div>
      <div style={{ fontSize: 15, color: "var(--text-dim)", marginTop: 6 }}>{subtitle}</div>
    </button>
  );
}

function GameRoom({ gameType }: { gameType: GameType }) {
  const { roomCode, state, roundEnd, countdown } = useRoomHost(gameType);

  const joinUrl = encodeJoinUrl({
    v: PROTOCOL_VERSION,
    room: roomCode,
    gameType,
    supabaseUrl: SUPABASE_URL_PUBLIC,
    supabaseAnonKey: SUPABASE_ANON_PUBLIC,
  });

  if (!state) {
    const label = gameType === "yaniv" ? "יניב" : "ג׳ין";
    return (
      <div className="lobby">
        <div className="title">
          <span className="accent">{label}</span> TV
        </div>
        <div style={{ color: "var(--text-dim)" }}>{HE.loading}</div>
      </div>
    );
  }

  const isLobbyLike =
    state.status === "lobby" ||
    (state.status === "round_end" && state.players.every((p: any) => !p.ready));

  return (
    <>
      {isLobbyLike ? (
        <Lobby state={state} joinUrl={joinUrl} countdown={countdown} />
      ) : (
        <>
          {countdown !== null ? (
            <div className="lobby">
              <div className="countdown" key={countdown}>
                {countdown}
              </div>
            </div>
          ) : gameType === "gin" ? (
            <GinTableView state={state} />
          ) : (
            <YanivTableView state={state} />
          )}
          {roundEnd && countdown === null && (gameType === "gin" ? (
            <GinRoundEnd payload={roundEnd as any} state={state as any} />
          ) : (
            <YanivRoundEnd payload={roundEnd as any} state={state} />
          ))}
        </>
      )}
    </>
  );
}

export default function App() {
  const [game, setGame] = useState<GameType | null>(() => readSavedGame());
  useEffect(() => {
    if (game) {
      try {
        localStorage.setItem(GAME_STORAGE_KEY, game);
      } catch {}
    }
  }, [game]);

  return (
    <div className="app">
      <div className="tv-frame">
        <div className="table">
          {game === null ? (
            <GamePicker onPick={setGame} />
          ) : (
            <GameRoom gameType={game} />
          )}
        </div>
      </div>
      {game !== null && (
        <button
          onClick={() => {
            try {
              localStorage.removeItem(GAME_STORAGE_KEY);
            } catch {}
            setGame(null);
          }}
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 200,
            background: "rgba(20,50,42,0.9)",
            border: "1px solid rgba(212,168,91,0.3)",
            color: "var(--text)",
            padding: "8px 14px",
            borderRadius: 10,
            fontSize: 14,
            cursor: "pointer",
          }}
          title="חזרה לבחירת משחק"
        >
          ↺ החלף משחק
        </button>
      )}
      <MuteButton />
    </div>
  );
}
