import React, { useState } from "react";
import { isMuted, setMuted } from "./sounds";

export function MuteButton() {
  const [m, setM] = useState(isMuted());
  return (
    <button
      onClick={() => {
        const next = !m;
        setMuted(next);
        setM(next);
      }}
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 200,
        background: "rgba(20,50,42,0.9)",
        border: "1px solid rgba(212,168,91,0.3)",
        color: "var(--text)",
        padding: "8px 12px",
        borderRadius: 10,
        fontSize: 18,
        cursor: "pointer",
      }}
      title={m ? "השמע צלילים" : "השתק"}
      aria-label={m ? "השמע צלילים" : "השתק"}
    >
      {m ? "🔇" : "🔊"}
    </button>
  );
}
