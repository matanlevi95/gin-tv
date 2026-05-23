import React, { useEffect, useState } from "react";
import { HE, encodeJoinUrl, PROTOCOL_VERSION } from "@gin-tv/shared";
import { Lobby } from "./Lobby";
import { TableView } from "./TableView";
import { RoundEnd } from "./RoundEnd";
import { useRoomHost } from "./useRoomHost";
import { SUPABASE_ANON_PUBLIC, SUPABASE_URL_PUBLIC } from "./supabase";

export default function App() {
  const { roomCode, tokens, state, roundEnd, countdown, matchEnd } = useRoomHost();
  const [error, setError] = useState("");

  // The QR encodes the room code, the first slot's token, and Supabase creds
  // so the phone can connect without any backend of ours.
  // The second phone scans the same QR — for now we let both phones use the
  // same QR but pick different tokens (the host picks whichever slot is free
  // based on which token has been seen first). To keep it dead simple in this
  // version, we encode both tokens and the phone picks the first unclaimed one.
  // (Simpler: encode just token[0], phone tries it; if "ROOM_FULL", it retries
  //  with token[1]. We'll implement that on the mobile side.)
  const joinUrl1 = encodeJoinUrl({
    v: PROTOCOL_VERSION,
    room: roomCode,
    token: tokens[0] || "x",
    supabaseUrl: SUPABASE_URL_PUBLIC,
    supabaseAnonKey: SUPABASE_ANON_PUBLIC,
  });
  const joinUrl2 = encodeJoinUrl({
    v: PROTOCOL_VERSION,
    room: roomCode,
    token: tokens[1] || "y",
    supabaseUrl: SUPABASE_URL_PUBLIC,
    supabaseAnonKey: SUPABASE_ANON_PUBLIC,
  });

  // Suppress lint about `error` for now — host doesn't surface errors to TV in
  // this MVP; we keep the toast machinery for future use.
  useEffect(() => {
    if (matchEnd) {
      // Could show a "match over" card later; for now the round_end view covers it
    }
  }, [matchEnd]);

  if (!state) {
    return (
      <div className="app">
        <div className="lobby">
          <div className="title">
            <span className="accent">ג׳ין</span> TV
          </div>
          <div style={{ color: "var(--text-dim)" }}>{HE.loading}</div>
        </div>
      </div>
    );
  }

  const isLobbyLike =
    state.status === "lobby" ||
    (state.status === "round_end" && state.players.every((p) => !p.ready));

  return (
    <div className="app">
      <div className="tv-frame">
        <div className="table">
          {isLobbyLike ? (
            <Lobby
              state={state}
              joinUrl1={joinUrl1}
              joinUrl2={joinUrl2}
              countdown={countdown}
            />
          ) : (
            <>
              {countdown !== null ? (
                <div className="lobby">
                  <div className="countdown" key={countdown}>
                    {countdown}
                  </div>
                </div>
              ) : (
                <TableView state={state} />
              )}
              {roundEnd && countdown === null && (
                <RoundEnd payload={roundEnd} state={state} />
              )}
            </>
          )}
        </div>
      </div>
      {error && <div className="error-toast">{error}</div>}
    </div>
  );
}
