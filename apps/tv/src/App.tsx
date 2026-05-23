import React from "react";
import { HE, encodeJoinUrl, PROTOCOL_VERSION } from "@gin-tv/shared";
import { Lobby } from "./Lobby";
import { TableView } from "./TableView";
import { RoundEnd } from "./RoundEnd";
import { useRoomHost } from "./useRoomHost";
import { SUPABASE_ANON_PUBLIC, SUPABASE_URL_PUBLIC } from "./supabase";

export default function App() {
  const { roomCode, state, roundEnd, countdown } = useRoomHost();

  const joinUrl = encodeJoinUrl({
    v: PROTOCOL_VERSION,
    room: roomCode,
    supabaseUrl: SUPABASE_URL_PUBLIC,
    supabaseAnonKey: SUPABASE_ANON_PUBLIC,
  });

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
            <Lobby state={state} joinUrl={joinUrl} countdown={countdown} />
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
    </div>
  );
}
