import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { HE, PublicGameState } from "@gin-tv/shared";

interface Props {
  state: PublicGameState;
  joinUrl: string;
  countdown?: number | null;
}

export function Lobby({ state, joinUrl, countdown }: Props) {
  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(joinUrl, { width: 360, margin: 1 }).then(setQr).catch(() => {});
  }, [joinUrl]);

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

      <div style={{ color: "var(--text-dim)", fontSize: 22, marginBottom: 8 }}>
        {HE.scanToJoin}
      </div>

      <div className="lobby-card" style={{ padding: 24, gap: 14 }}>
        <div className="qr-frame">
          {qr ? <img src={qr} width={320} height={320} alt="QR" /> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
          <div style={{ fontSize: 18, color: "var(--text-dim)" }}>{HE.roomCode}</div>
          <div className="room-code">{state.roomCode}</div>
        </div>
        <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: -4 }}>
          או הקלידו את הקוד ידנית באפליקציה
        </div>
      </div>

      <div className="players-strip">
        {state.players.map((p) => (
          <div key={p.id} className={`player-chip ${p.ready ? "ready" : ""}`}>
            <div className="avatar">{p.avatar || p.name?.[0] || "?"}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="ready-label">{p.ready ? HE.ready : HE.notReady}</div>
            </div>
            <div className="ready-dot" />
          </div>
        ))}
        {Array.from({ length: 2 - state.players.length }).map((_, i) => (
          <div key={`slot-${i}`} className="player-chip" style={{ opacity: 0.45 }}>
            <div className="avatar">?</div>
            <div>
              <div style={{ fontWeight: 700 }}>{HE.waitingOpponent}</div>
              <div className="ready-label">—</div>
            </div>
            <div className="ready-dot" />
          </div>
        ))}
      </div>

      {state.players.length === 2 && !state.players.every((p) => p.ready) && (
        <div style={{ color: "var(--text-dim)", fontSize: 18 }}>
          לחצו <b style={{ color: "var(--gold)" }}>{HE.ready}</b> בנייד כשמוכנים
        </div>
      )}
    </div>
  );
}
