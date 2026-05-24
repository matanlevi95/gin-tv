import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { HE, GameType } from "@gin-tv/shared";

interface Props {
  state: any;
  joinUrl: string;
  countdown?: number | null;
}

const GAME_LABEL: Record<GameType, string> = {
  gin: "ג׳ין",
  yaniv: "יניב",
};

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

  const gameLabel = GAME_LABEL[(state.gameType as GameType) ?? "gin"];

  return (
    <div className="lobby-landscape">
      {/* Right column (visual right in RTL = primary): identity + code + players */}
      <div className="lobby-side">
        <div className="title" style={{ fontSize: 84 }}>
          <span className="accent">{gameLabel}</span> TV
        </div>

        <div className="code-block">
          <div className="code-label">{HE.roomCode}</div>
          <div className="room-code huge">{state.roomCode}</div>
          <div className="code-hint">סרקו את ה-QR או הקלידו את הקוד באפליקציה</div>
        </div>

        <div className="lobby-players">
          {state.players.map((p: any) => (
            <div key={p.id} className={`player-chip ${p.ready ? "ready" : ""}`}>
              <div className="avatar">{p.avatar || p.name?.[0] || "?"}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{p.name}</div>
                <div className="ready-label">{p.ready ? HE.ready : HE.notReady}</div>
              </div>
              <div className="ready-dot" />
            </div>
          ))}
          {Array.from({ length: 2 - state.players.length }).map((_, i) => (
            <div key={`slot-${i}`} className="player-chip" style={{ opacity: 0.45 }}>
              <div className="avatar">?</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{HE.waitingOpponent}</div>
                <div className="ready-label">—</div>
              </div>
              <div className="ready-dot" />
            </div>
          ))}
        </div>

        {state.players.length === 2 && !state.players.every((p: any) => p.ready) && (
          <div className="ready-hint">
            לחצו <b style={{ color: "var(--gold)" }}>{HE.ready}</b> בנייד כשמוכנים
          </div>
        )}
      </div>

      {/* Left column (visual left in RTL): QR */}
      <div className="lobby-qr-wrap">
        <div className="qr-frame">
          {qr ? <img src={qr} width={420} height={420} alt="QR" /> : null}
        </div>
        <div className="qr-caption">{HE.scanToJoin}</div>
      </div>
    </div>
  );
}
