import "react-native-url-polyfill/auto";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type {
  ActionEvent,
  PrivateEvent,
  PrivateHandState,
  PublicEvent,
  PublicGameState,
  RoundEndPayload,
} from "@gin-tv/shared";
import { playerChannel, roomChannel } from "@gin-tv/shared";
import Constants from "expo-constants";

const STORAGE_PROFILE = "ginTv:profile";
const STORAGE_SESSION = "ginTv:lastSession";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const DEFAULT_SUPABASE_URL = extra.supabaseUrl ?? "";
const DEFAULT_SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? "";

export interface PlayerProfile {
  id: string;
  name: string;
  avatarLetter: string;
  totalWins: number;
  winStreak: number;
  gamesPlayed: number;
  firstWin: boolean;
  firstGin: boolean;
  threeStreak: boolean;
  knockWin: boolean;
  undercut: boolean;
  ach10: boolean;
  ach50: boolean;
}

const emptyProfile: PlayerProfile = {
  id: `g_${Math.floor(Math.random() * 1e9)}`,
  name: "אורח",
  avatarLetter: "א",
  totalWins: 0,
  winStreak: 0,
  gamesPlayed: 0,
  firstWin: false,
  firstGin: false,
  threeStreak: false,
  knockWin: false,
  undercut: false,
  ach10: false,
  ach50: false,
};

export interface HistoryEntry {
  date: number;
  opponent: string;
  won: boolean;
  finalScore: number;
}

interface SessionRefs {
  roomCode: string;
  token: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  client: SupabaseClient;
  roomChan: RealtimeChannel;
  privateChan: RealtimeChannel;
}

interface GameCtx {
  profile: PlayerProfile;
  setProfile: (p: PlayerProfile) => Promise<void>;
  history: HistoryEntry[];
  addHistory: (h: HistoryEntry) => Promise<void>;

  connectionState: "idle" | "connecting" | "connected" | "error";

  roomCode: string | null;
  playerId: string | null;
  publicState: PublicGameState | null;
  privateState: PrivateHandState | null;
  lastRoundEnd: RoundEndPayload | null;
  matchEnd: { winner: string; totals: Record<string, number> } | null;
  errorMessage: string | null;

  joinRoom: (params: {
    roomCode: string;
    token: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  ready: (r: boolean) => void;
  readyNext: () => void;
  drawDeck: () => void;
  drawDiscard: () => void;
  discardCard: (cardId: string) => void;
  knock: (discardCardId: string) => void;
  gin: (discardCardId: string) => void;
  reorderHand: (order: string[]) => void;
  reset: () => void;
}

const Ctx = createContext<GameCtx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<PlayerProfile>(emptyProfile);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [connectionState, setConnectionState] =
    useState<GameCtx["connectionState"]>("idle");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivateHandState | null>(null);
  const [lastRoundEnd, setLastRoundEnd] = useState<RoundEndPayload | null>(null);
  const [matchEnd, setMatchEnd] = useState<GameCtx["matchEnd"]>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionRef = useRef<SessionRefs | null>(null);

  // ---- Persistence ----
  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(STORAGE_PROFILE);
        if (p) setProfileState({ ...emptyProfile, ...JSON.parse(p) });
        const h = await AsyncStorage.getItem("ginTv:history");
        if (h) setHistory(JSON.parse(h));
      } catch {}
    })();
    return () => {
      teardownSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setProfile = useCallback(async (p: PlayerProfile) => {
    setProfileState(p);
    try {
      await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
    } catch {}
  }, []);

  const addHistory = useCallback(async (h: HistoryEntry) => {
    setHistory((prev) => {
      const next = [h, ...prev].slice(0, 100);
      AsyncStorage.setItem("ginTv:history", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ---- Helpers ----
  const sendAction = useCallback((ev: ActionEvent) => {
    const s = sessionRef.current;
    if (!s) return;
    s.roomChan.send({ type: "broadcast", event: "action", payload: ev }).catch(() => {});
  }, []);

  function teardownSession() {
    const s = sessionRef.current;
    if (!s) return;
    try {
      s.client.removeChannel(s.roomChan);
      s.client.removeChannel(s.privateChan);
    } catch {}
    sessionRef.current = null;
  }

  // ---- Join ----
  const joinRoom = useCallback<GameCtx["joinRoom"]>(
    async ({ roomCode: code, token, supabaseUrl, supabaseAnonKey }) => {
      const url = supabaseUrl || DEFAULT_SUPABASE_URL;
      const key = supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
      if (!url || !key) {
        return { ok: false, error: "חסרים פרטי Supabase" };
      }

      // Tear down any prior session.
      teardownSession();
      setConnectionState("connecting");
      setLastRoundEnd(null);
      setMatchEnd(null);

      const client = createClient(url, key, {
        realtime: { params: { eventsPerSecond: 20 } },
      });

      const roomChan = client.channel(roomChannel(code), {
        config: { broadcast: { self: false } },
      });
      const privateChan = client.channel(playerChannel(code, token), {
        config: { broadcast: { self: false } },
      });

      roomChan.on("broadcast", { event: "public" }, (msg) => {
        handlePublic(msg.payload as PublicEvent, token);
      });

      privateChan.on("broadcast", { event: "private" }, (msg) => {
        handlePrivate(msg.payload as PrivateEvent);
      });

      // Wait for both channels to subscribe.
      const subscribed = await new Promise<boolean>((resolve) => {
        let n = 0;
        const onDone = (ok: boolean) => {
          n++;
          if (!ok) return resolve(false);
          if (n === 2) resolve(true);
        };
        roomChan.subscribe((status) => {
          if (status === "SUBSCRIBED") onDone(true);
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onDone(false);
        });
        privateChan.subscribe((status) => {
          if (status === "SUBSCRIBED") onDone(true);
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onDone(false);
        });
      });
      if (!subscribed) {
        setConnectionState("error");
        return { ok: false, error: "חיבור נכשל" };
      }

      sessionRef.current = {
        roomCode: code,
        token,
        supabaseUrl: url,
        supabaseAnonKey: key,
        client,
        roomChan,
        privateChan,
      };
      setConnectionState("connected");
      setRoomCode(code);

      // Save session for reconnect.
      AsyncStorage.setItem(
        STORAGE_SESSION,
        JSON.stringify({ roomCode: code, token, supabaseUrl: url, supabaseAnonKey: key })
      ).catch(() => {});

      // Wait for the host's `joined` private event (up to ~5s) before resolving.
      const joinedOk = await new Promise<boolean>((resolve) => {
        let done = false;
        const t = setTimeout(() => {
          if (done) return;
          done = true;
          resolve(false);
        }, 5000);
        const off = privateChan.on("broadcast", { event: "private" }, (msg) => {
          const ev = msg.payload as PrivateEvent;
          if (ev.kind === "joined") {
            if (done) return;
            done = true;
            clearTimeout(t);
            setPlayerId(ev.playerId);
            resolve(true);
          }
        });
        // Send hello to introduce ourselves.
        sendHello(roomChan, token, profileRef.current);
        // Note: the .on() returns the channel, not an unsubscriber. We rely on
        // removeChannel during teardown.
        void off;
      });

      if (!joinedOk) {
        setConnectionState("error");
        return { ok: false, error: "אין תגובה מהטלוויזיה" };
      }

      return { ok: true };
    },
    []
  );

  // We need the latest profile inside joinRoom but don't want it as a dep.
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  function handlePublic(ev: PublicEvent, myToken: string) {
    switch (ev.kind) {
      case "state":
        if (ev.payload.status === "playing") setLastRoundEnd(null);
        setPublicState(ev.payload);
        return;
      case "round_end":
        setLastRoundEnd(ev.payload);
        return;
      case "match_end":
        setMatchEnd({ winner: ev.winner, totals: ev.totals });
        return;
      case "game_start":
        setLastRoundEnd(null);
        return;
      case "error":
        if (!ev.toToken || ev.toToken === myToken) {
          setErrorMessage(ev.message);
          if (errTimer.current) clearTimeout(errTimer.current);
          errTimer.current = setTimeout(() => setErrorMessage(null), 3000);
        }
        return;
      case "ping":
        return;
    }
  }

  function handlePrivate(ev: PrivateEvent) {
    switch (ev.kind) {
      case "hand":
        setPrivateState(ev.payload);
        return;
      case "joined":
        setPlayerId(ev.playerId);
        return;
    }
  }

  const ready = useCallback(
    (r: boolean) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "ready", fromToken: s.token, ready: r });
    },
    [sendAction]
  );
  const readyNext = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    sendAction({ kind: "ready_next", fromToken: s.token });
  }, [sendAction]);
  const drawDeck = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    sendAction({ kind: "draw_deck", fromToken: s.token });
  }, [sendAction]);
  const drawDiscard = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    sendAction({ kind: "draw_discard", fromToken: s.token });
  }, [sendAction]);
  const discardCard = useCallback(
    (cardId: string) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "discard", fromToken: s.token, cardId });
    },
    [sendAction]
  );
  const knock = useCallback(
    (discardCardId: string) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "knock", fromToken: s.token, discardCardId });
    },
    [sendAction]
  );
  const gin = useCallback(
    (discardCardId: string) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "gin", fromToken: s.token, discardCardId });
    },
    [sendAction]
  );
  const reorderHand = useCallback(
    (order: string[]) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "reorder_hand", fromToken: s.token, order });
    },
    [sendAction]
  );
  const reset = useCallback(() => {
    setRoomCode(null);
    setPlayerId(null);
    setPublicState(null);
    setPrivateState(null);
    setLastRoundEnd(null);
    setMatchEnd(null);
    teardownSession();
    setConnectionState("idle");
    AsyncStorage.removeItem(STORAGE_SESSION).catch(() => {});
  }, []);

  const value = useMemo<GameCtx>(
    () => ({
      profile,
      setProfile,
      history,
      addHistory,
      connectionState,
      roomCode,
      playerId,
      publicState,
      privateState,
      lastRoundEnd,
      matchEnd,
      errorMessage,
      joinRoom,
      ready,
      readyNext,
      drawDeck,
      drawDiscard,
      discardCard,
      knock,
      gin,
      reorderHand,
      reset,
    }),
    [
      profile,
      setProfile,
      history,
      addHistory,
      connectionState,
      roomCode,
      playerId,
      publicState,
      privateState,
      lastRoundEnd,
      matchEnd,
      errorMessage,
      joinRoom,
      ready,
      readyNext,
      drawDeck,
      drawDiscard,
      discardCard,
      knock,
      gin,
      reorderHand,
      reset,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function sendHello(
  channel: RealtimeChannel,
  token: string,
  profile: PlayerProfile
) {
  const ev: ActionEvent = {
    kind: "hello",
    fromToken: token,
    name: profile.name,
    avatar: profile.avatarLetter,
  };
  channel.send({ type: "broadcast", event: "action", payload: ev }).catch(() => {});
}

export function useGame() {
  const c = useContext(Ctx);
  if (!c) throw new Error("GameProvider missing");
  return c;
}
