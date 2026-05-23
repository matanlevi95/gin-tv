/**
 * Hosts a single room on the TV side: spins up a RoomHost, opens the Supabase
 * room channel, and emits PublicGameState / RoundEndPayload via React state.
 *
 * The TV is the authority — there is no server in this architecture.
 */
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ActionEvent,
  PrivateEvent,
  PublicEvent,
  PublicGameState,
  RoomHost,
  RoundEndPayload,
  generateRoomCode,
  playerChannel,
  roomChannel,
} from "@gin-tv/shared";
import { supabase } from "./supabase";

export interface RoomHostHandle {
  roomCode: string;
  tokens: [string, string];
  state: PublicGameState | null;
  roundEnd: RoundEndPayload | null;
  matchEnd: { winner: string; totals: Record<string, number> } | null;
  countdown: number | null;
}

export function useRoomHost(): RoomHostHandle {
  const [roomCode] = useState(() => generateRoomCode());
  const [state, setState] = useState<PublicGameState | null>(null);
  const [roundEnd, setRoundEnd] = useState<RoundEndPayload | null>(null);
  const [matchEnd, setMatchEnd] = useState<RoomHostHandle["matchEnd"]>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const hostRef = useRef<RoomHost | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tokensRef = useRef<[string, string] | null>(null);

  useEffect(() => {
    // 1. Open the room channel.
    const channel = supabase.channel(roomChannel(roomCode), {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = channel;

    // 2. Create the host. The broadcast layer sends through this channel.
    const host = new RoomHost(
      {
        emitPublic: (ev: PublicEvent) => {
          // mirror into local React state
          if (ev.kind === "state") {
            setState(ev.payload);
            if (ev.payload.status === "playing") setRoundEnd(null);
          } else if (ev.kind === "round_end") {
            setRoundEnd(ev.payload);
          } else if (ev.kind === "match_end") {
            setMatchEnd({ winner: ev.winner, totals: ev.totals });
          } else if (ev.kind === "game_start") {
            setRoundEnd(null);
            runCountdown(setCountdown);
          }
          // broadcast to subscribers (phones)
          channel.send({ type: "broadcast", event: "public", payload: ev });
        },
        emitPrivate: (toToken: string, ev: PrivateEvent) => {
          // Each player has their own channel; send via a freshly opened sender.
          const ch = supabase.channel(playerChannel(roomCode, toToken), {
            config: { broadcast: { self: false } },
          });
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              ch.send({ type: "broadcast", event: "private", payload: ev }).finally(
                () => {
                  // Tear down — we only used it for one outbound message.
                  supabase.removeChannel(ch);
                }
              );
            }
          });
        },
      },
      roomCode
    );
    hostRef.current = host;
    tokensRef.current = host.slotTokens;

    // Render the lobby immediately — don't wait for Supabase to subscribe.
    setState(host.snapshotPublic());

    // 3. Listen for actions from phones on the room channel.
    channel.on("broadcast", { event: "action" }, (msg) => {
      const ev = msg.payload as ActionEvent;
      host.handleAction(ev);
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
    };
    // We intentionally never re-run this effect: the room code is fixed for the page lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    roomCode,
    tokens: tokensRef.current ?? ["", ""],
    state,
    roundEnd,
    matchEnd,
    countdown,
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
