import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { HE, PublicGameState } from "@gin-tv/shared";

interface Props {
  state: PublicGameState;
  joinUrl1: string; // QR for seat 1
  joinUrl2: string; // QR for seat 2
  countdown?: number | null;
}

export function Lobby({ state, joinUrl1, joinUrl2, countdown }: Props) {
  const [qr1, setQr1] = useState<string>("");
  const [qr2, setQr2] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(joinUrl1, { width: 280, margin: 1 }).then(setQr1).catch(() => {});
    QRCode.toDataURL(joinUrl2, { width: 280, margin: 1 }).then(setQr2).catch(() => {});
  }, [joinUrl1, joinUrl2]);

  if (countdown && countdown > 0) {
    return (
      <div className="lobby">
        <div className="countdown" key={countdown}>{countdown}</div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="title">
        <span className="accent">ג׳ין</span> TV
      </div>

      <div style={{ color: "var(--text-dim)", fontSize: 20, marginBottom: 4 }}>
        {HE.scanToJoin}
      </div>

      <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
        <PlayerSlot
          label="שחקן 1"
          qr={qr1}
          player={state.players[0]}
        />
        <PlayerSlot
          label="שחקן 2"
          qr={qr2}
          player={state.players[1]}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <div style={{ fontSize: 16, color: "var(--text-dim)" }}>{HE.roomCode}</div>
        <div className="room-code" style={{ fontSize: 56 }}>{state.roomCode}</div>
      </div>

      {state.players.length === 2 && !state.players.every((p) => p.ready) && (
        <div style={{ color: "var(--text-dim)", fontSize: 18 }}>
          לחצו <b style={{ color: "var(--gold)" }}>{HE.ready}</b> בנייד כשמוכנים
        </div>
      )}
    </div>
  );
}

function PlayerSlot({
  label,
  qr,
  player,
}: {
  label: string;
  qr: string;
  player?: PublicGameState["players"][number];
}) {
  const joined = !!player;
  const ready = !!player?.ready;
  return (
    <div
      className="lobby-card"
      style={{
        position: "relative",
        gap: 10,
        padding: "22px 26px",
        border: `1px solid ${ready ? "var(--accent)" : joined ? "var(--gold)" : "rgba(212,168,91,0.3)"}`,
      }}
    >
      <div style={{ color: joined ? "var(--gold-soft)" : "var(--text-dim)", fontSize: 18, fontWeight: 700 }}>
        {label}
      </div>
      <div className="qr-frame" style={{ position: "relative" }}>
        {qr ? <img src={qr} width={260} height={260} alt="QR" /> : null}
        {joined && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(20, 50, 42, 0.92)",
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 64 }}>{ready ? "✓" : "👤"}</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "var(--cream)" }}>
              {player?.name}
            </div>
            <div
              style={{
                fontSize: 14,
                color: ready ? "var(--accent)" : "var(--text-dim)",
                fontWeight: 700,
              }}
            >
              {ready ? HE.ready : HE.notReady}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
