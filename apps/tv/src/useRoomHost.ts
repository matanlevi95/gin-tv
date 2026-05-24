/**
 * Hosts a single room on the TV side: spins up a RoomHost, opens the Supabase
 * room channel, and emits PublicGameState / RoundEndPayload via React state.
 *
 * The TV is the authority — there is no server in this architecture.
 *
 * Room code persistence: each TV keeps a stable 4-char code in localStorage so
 * that phones who saved this TV in their profile can identify it across
 * sessions. If the user wants a fresh code, they can clear localStorage.
 */
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ActionEvent,
  GameType,
  PrivateEvent,
  PublicEvent,
  PublicGameState,
  RoomHost,
  RoundEndPayload,
  generateRoomCode,
  isValidRoomCode,
  playerChannel,
  roomChannel,
} from "@gin-tv/shared";
import { supabase } from "./supabase";
import { play } from "./sounds";

const STORAGE_KEY = "ginTv:tvCode";

function loadOrCreateTvCode(): string {
  try {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved && isValidRoomCode(saved)) return saved;
  } catch {}
  const fresh = generateRoomCode();
  try {
    localStorage.setItem(STORAGE_KEY, fresh);
  } catch {}
  return fresh;
}

export interface RoomHostHandle {
  roomCode: string;
  gameType: GameType;
  /** State is a union — game-specific UIs narrow by `state.gameType`. */
  state: any | null;
  roundEnd: RoundEndPayload | null;
  matchEnd: { winner: string; totals: Record<string, number> } | null;
  countdown: number | null;
  /** Reset the TV's stable code (clears localStorage). UI calls this when needed. */
  rotateCode: () => void;
}

export function useRoomHost(gameType: GameType): RoomHostHandle {
  const [roomCode, setRoomCode] = useState(() => loadOrCreateTvCode());
  const [state, setState] = useState<any | null>(null);
  const [roundEnd, setRoundEnd] = useState<RoundEndPayload | null>(null);
  const [matchEnd, setMatchEnd] = useState<RoomHostHandle["matchEnd"]>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const hostRef = useRef<RoomHost | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  /** One persistent sender channel per player token, so back-to-back private
   *  emits don't collide on a transient channel that's still tearing down. */
  const senderByToken = useRef<Map<string, { ch: RealtimeChannel; ready: Promise<void> }>>(new Map());

  useEffect(() => {
    // 1. Open the room channel for actions + public broadcasts.
    const channel = supabase.channel(roomChannel(roomCode), {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;

    // 2. Create the host. The broadcast layer sends through this channel.
    const host = new RoomHost(
      {
        emitPublic: (ev: PublicEvent) => {
          if (ev.kind === "state") {
            // Detect transitions to play sound effects.
            setState((prev: any) => {
              if (prev && ev.payload.lastAction?.at !== prev.lastAction?.at) {
                const kind = ev.payload.lastAction?.kind;
                if (kind === "draw_deck" || kind === "draw_discard") play("draw");
                else if (kind === "discard") play("discard");
                else if (kind === "deal") play("deal");
              }
              return ev.payload;
            });
            if (ev.payload.status === "playing") setRoundEnd(null);
          } else if (ev.kind === "round_end") {
            setRoundEnd(ev.payload);
            if (ev.payload.reason === "gin") play("gin");
            else if (ev.payload.reason === "knock") play("knock");
            else if (ev.payload.reason === "undercut") play("undercut");
          } else if (ev.kind === "match_end") {
            setMatchEnd({ winner: ev.winner, totals: ev.totals });
            play("win");
          } else if (ev.kind === "game_start") {
            setRoundEnd(null);
            runCountdown(setCountdown);
            play("deal");
          }
          channel.send({ type: "broadcast", event: "public", payload: ev });
        },
        emitPrivate: (toToken: string, ev: PrivateEvent) => {
          let entry = senderByToken.current.get(toToken);
          if (!entry) {
            const ch = supabase.channel(playerChannel(roomCode, toToken), {
              config: { broadcast: { self: false, ack: false } },
            });
            const ready = new Promise<void>((resolve) => {
              ch.subscribe((status) => {
                if (status === "SUBSCRIBED") resolve();
              });
            });
            entry = { ch, ready };
            senderByToken.current.set(toToken, entry);
          }
          entry.ready
            .then(() =>
              entry!.ch.send({ type: "broadcast", event: "private", payload: ev })
            )
            .catch(() => {});
        },
      },
      { roomCode, gameType }
    );
    hostRef.current = host;

    setState(host.snapshotPublic());

    channel.on("broadcast", { event: "action" }, (msg) => {
      host.handleAction(msg.payload as ActionEvent);
    });

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[gin-tv] room channel subscribe failed:", status);
      }
    });

    return () => {
      host.destroy();
      hostRef.current = null;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      for (const entry of senderByToken.current.values()) {
        try {
          supabase.removeChannel(entry.ch);
        } catch {}
      }
      senderByToken.current.clear();
    };
  }, [roomCode, gameType]);

  const rotateCode = () => {
    const fresh = generateRoomCode();
    try {
      localStorage.setItem(STORAGE_KEY, fresh);
    } catch {}
    setRoomCode(fresh);
  };

  return {
    roomCode,
    gameType,
    state,
    roundEnd,
    matchEnd,
    countdown,
    rotateCode,
  };
}

function runCountdown(setCountdown: (n: number | null) => void) {
  let n = 3;
  setCountdown(n);
  const t = setInterval(() => {
    n -= 1;
    if (n <= 0) {
      clearInterval(t);
      setCountdown(null);
    } else {
      setCountdown(n);
    }
  }, 700);
}
