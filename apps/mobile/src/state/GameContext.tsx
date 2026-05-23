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
import {
  ActionEvent,
  PrivateEvent,
  PrivateHandState,
  PublicEvent,
  PublicGameState,
  RoundEndPayload,
  generatePlayerToken,
  playerChannel,
  roomChannel,
} from "@gin-tv/shared";
import Constants from "expo-constants";

const STORAGE_PROFILE = "ginTv:profile";
const STORAGE_HISTORY = "ginTv:history";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};
const DEFAULT_SUPABASE_URL = extra.supabaseUrl ?? "";
const DEFAULT_SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? "";

/** Each user has a stable per-device profile + a list of saved TVs. */
export interface SavedTV {
  code: string; // 4-char TV identifier
  label: string; // user-given name, e.g. "סלון"
  supabaseUrl: string;
  supabaseAnonKey: string;
  lastConnectedAt: number;
}

export interface PlayerProfile {
  id: string; // stable random per-device player id
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
  tvs: SavedTV[];
}

function newGuestProfile(): PlayerProfile {
  return {
    id: `p_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
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
    tvs: [],
  };
}

export interface HistoryEntry {
  date: number;
  opponent: string;
  won: boolean;
  finalScore: number;
}

export type TvStatus = "online" | "offline" | "checking";

interface SessionRefs {
  roomCode: string;
  privateToken: string;
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
  saveTV: (tv: SavedTV) => Promise<void>;
  removeTV: (code: string) => Promise<void>;

  connectionState: "idle" | "connecting" | "connected" | "error";
  tvStatuses: Record<string, TvStatus>;
  /** Begin polling online status for every saved TV; cleans up on unmount. */
  startTvStatusPoll: () => void;
  stopTvStatusPoll: () => void;

  roomCode: string | null;
  playerId: string | null;
  publicState: PublicGameState | null;
  privateState: PrivateHandState | null;
  lastRoundEnd: RoundEndPayload | null;
  matchEnd: { winner: string; totals: Record<string, number> } | null;
  errorMessage: string | null;

  joinRoom: (params: {
    roomCode: string;
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
  const [profile, setProfileState] = useState<PlayerProfile>(() => newGuestProfile());
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
  const [tvStatuses, setTvStatuses] = useState<Record<string, TvStatus>>({});
  const tvStatusClientsRef = useRef<Map<string, { client: SupabaseClient; chan: RealtimeChannel; lastPing: number }>>(new Map());
  const tvStatusTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionRef = useRef<SessionRefs | null>(null);
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // ---- Persistence ----
  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(STORAGE_PROFILE);
        if (p) setProfileState({ ...newGuestProfile(), ...JSON.parse(p) });
        const h = await AsyncStorage.getItem(STORAGE_HISTORY);
        if (h) setHistory(JSON.parse(h));
      } catch {}
    })();
    return () => {
      teardownSession();
      stopTvStatusPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistProfile = useCallback(async (p: PlayerProfile) => {
    setProfileState(p);
    try {
      await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
    } catch {}
  }, []);

  const addHistory = useCallback(async (h: HistoryEntry) => {
    setHistory((prev) => {
      const next = [h, ...prev].slice(0, 100);
      AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const saveTV = useCallback(
    async (tv: SavedTV) => {
      const existing = profileRef.current.tvs.filter((t) => t.code !== tv.code);
      const next: PlayerProfile = {
        ...profileRef.current,
        tvs: [...existing, tv].sort((a, b) => b.lastConnectedAt - a.lastConnectedAt),
      };
      await persistProfile(next);
    },
    [persistProfile]
  );

  const removeTV = useCallback(
    async (code: string) => {
      const next: PlayerProfile = {
        ...profileRef.current,
        tvs: profileRef.current.tvs.filter((t) => t.code !== code),
      };
      await persistProfile(next);
      const refs = tvStatusClientsRef.current;
      const item = refs.get(code);
      if (item) {
        try {
          item.client.removeChannel(item.chan);
        } catch {}
        refs.delete(code);
      }
      setTvStatuses((s) => {
        const next = { ...s };
        delete next[code];
        return next;
      });
    },
    [persistProfile]
  );

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

  // ---- Online-status polling ----
  const stopTvStatusPoll = useCallback(() => {
    if (tvStatusTickerRef.current) {
      clearInterval(tvStatusTickerRef.current);
      tvStatusTickerRef.current = null;
    }
    const refs = tvStatusClientsRef.current;
    for (const [code, item] of refs) {
      try {
        item.client.removeChannel(item.chan);
      } catch {}
      refs.delete(code);
    }
    setTvStatuses({});
  }, []);

  const startTvStatusPoll = useCallback(() => {
    // Reconcile subscriptions against profile.tvs
    const refs = tvStatusClientsRef.current;
    const desired = new Set(profileRef.current.tvs.map((t) => t.code));
    // Remove ones we no longer need
    for (const code of Array.from(refs.keys())) {
      if (!desired.has(code)) {
        const item = refs.get(code)!;
        try {
          item.client.removeChannel(item.chan);
        } catch {}
        refs.delete(code);
      }
    }
    // Add new ones
    for (const tv of profileRef.current.tvs) {
      if (refs.has(tv.code)) continue;
      if (!tv.supabaseUrl || !tv.supabaseAnonKey) continue;
      const client = createClient(tv.supabaseUrl, tv.supabaseAnonKey, {
        realtime: { params: { eventsPerSecond: 20 } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const chan = client.channel(roomChannel(tv.code), {
        config: { broadcast: { self: false } },
      });
      chan.on("broadcast", { event: "public" }, (msg) => {
        const ev = msg.payload as PublicEvent;
        if (ev.kind === "ping" || ev.kind === "state" || ev.kind === "game_start") {
          const item = refs.get(tv.code);
          if (item) {
            item.lastPing = Date.now();
            setTvStatuses((s) => ({ ...s, [tv.code]: "online" }));
          }
        }
      });
      chan.subscribe();
      refs.set(tv.code, { client, chan, lastPing: 0 });
      setTvStatuses((s) => ({ ...s, [tv.code]: "checking" }));
    }
    // Start ticker that flips to offline if no ping in 10s
    if (!tvStatusTickerRef.current) {
      tvStatusTickerRef.current = setInterval(() => {
        const now = Date.now();
        setTvStatuses((prev) => {
          const next = { ...prev };
          for (const [code, item] of tvStatusClientsRef.current) {
            const online = item.lastPing > 0 && now - item.lastPing < 10000;
            next[code] = online ? "online" : (item.lastPing > 0 ? "offline" : (next[code] || "checking"));
          }
          return next;
        });
      }, 2000);
    }
  }, []);

  // ---- Join ----
  const joinRoom = useCallback<GameCtx["joinRoom"]>(
    async ({ roomCode: code, supabaseUrl, supabaseAnonKey }) => {
      const url = supabaseUrl || DEFAULT_SUPABASE_URL;
      const key = supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
      if (!url || !key) {
        return { ok: false, error: "חסרים פרטי Supabase" };
      }

      teardownSession();
      setConnectionState("connecting");
      setLastRoundEnd(null);
      setMatchEnd(null);

      const client = createClient(url, key, {
        realtime: { params: { eventsPerSecond: 20 } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const privateToken = generatePlayerToken();

      const roomChan = client.channel(roomChannel(code), {
        config: { broadcast: { self: false } },
      });
      const privateChan = client.channel(playerChannel(code, privateToken), {
        config: { broadcast: { self: false } },
      });

      roomChan.on("broadcast", { event: "public" }, (msg) => {
        handlePublic(msg.payload as PublicEvent, privateToken);
      });
      privateChan.on("broadcast", { event: "private" }, (msg) => {
        handlePrivate(msg.payload as PrivateEvent);
      });

      const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        let roomStatus = "pending";
        let privStatus = "pending";
        let roomErr: string | undefined;
        let privErr: string | undefined;
        const settle = () => {
          if (roomStatus === "SUBSCRIBED" && privStatus === "SUBSCRIBED") {
            resolve({ ok: true });
          } else if (roomStatus !== "pending" && privStatus !== "pending") {
            const parts: string[] = [];
            parts.push(`room:${roomStatus}${roomErr ? `(${roomErr})` : ""}`);
            parts.push(`priv:${privStatus}${privErr ? `(${privErr})` : ""}`);
            resolve({ ok: false, error: parts.join(" ") });
          }
        };
        const summarize = (e: unknown): string | undefined => {
          if (!e) return undefined;
          if (typeof e === "string") return e.slice(0, 50);
          if (e instanceof Error) return e.message.slice(0, 50);
          try { return JSON.stringify(e).slice(0, 80); } catch { return String(e).slice(0, 50); }
        };
        roomChan.subscribe((s, e) => {
          if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            roomStatus = s;
            roomErr = summarize(e);
            settle();
          }
        });
        privateChan.subscribe((s, e) => {
          if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            privStatus = s;
            privErr = summarize(e);
            settle();
          }
        });
        setTimeout(() => {
          if (roomStatus === "pending") { roomStatus = "HARD_TIMEOUT"; settle(); }
          if (privStatus === "pending") { privStatus = "HARD_TIMEOUT"; settle(); }
        }, 12000);
      });
      if (!result.ok) {
        setConnectionState("error");
        return { ok: false, error: result.error || "חיבור נכשל" };
      }

      sessionRef.current = {
        roomCode: code,
        privateToken,
        supabaseUrl: url,
        supabaseAnonKey: key,
        client,
        roomChan,
        privateChan,
      };
      setConnectionState("connected");
      setRoomCode(code);

      // Wait for joined event (max ~6s) before resolving the promise.
      const joinedOk = await new Promise<boolean>((resolve) => {
        let done = false;
        const t = setTimeout(() => {
          if (done) return;
          done = true;
          resolve(false);
        }, 6000);
        privateChan.on("broadcast", { event: "private" }, (msg) => {
          const ev = msg.payload as PrivateEvent;
          if (ev.kind === "joined" && !done) {
            done = true;
            clearTimeout(t);
            setPlayerId(ev.playerId);
            resolve(true);
          }
        });
        // Send hello with the phone's stable playerId + freshly generated token.
        sendHello(roomChan, privateToken, profileRef.current);
      });

      if (!joinedOk) {
        setConnectionState("error");
        return { ok: false, error: "אין תגובה מהטלוויזיה — האם היא דלוקה?" };
      }

      return { ok: true };
    },
    []
  );

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

  const ready = useCallback((r: boolean) => {
    const s = sessionRef.current;
    if (!s) return;
    sendAction({ kind: "ready", fromToken: s.privateToken, ready: r });
  }, [sendAction]);
  const readyNext = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    sendAction({ kind: "ready_next", fromToken: s.privateToken });
  }, [sendAction]);
  const drawDeck = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    sendAction({ kind: "draw_deck", fromToken: s.privateToken });
  }, [sendAction]);
  const drawDiscard = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    sendAction({ kind: "draw_discard", fromToken: s.privateToken });
  }, [sendAction]);
  const discardCard = useCallback(
    (cardId: string) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "discard", fromToken: s.privateToken, cardId });
    },
    [sendAction]
  );
  const knock = useCallback(
    (discardCardId: string) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "knock", fromToken: s.privateToken, discardCardId });
    },
    [sendAction]
  );
  const gin = useCallback(
    (discardCardId: string) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "gin", fromToken: s.privateToken, discardCardId });
    },
    [sendAction]
  );
  const reorderHand = useCallback(
    (order: string[]) => {
      const s = sessionRef.current;
      if (!s) return;
      sendAction({ kind: "reorder_hand", fromToken: s.privateToken, order });
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
  }, []);

  const value = useMemo<GameCtx>(
    () => ({
      profile,
      setProfile: persistProfile,
      history,
      addHistory,
      saveTV,
      removeTV,
      connectionState,
      tvStatuses,
      startTvStatusPoll,
      stopTvStatusPoll,
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
      persistProfile,
      history,
      addHistory,
      saveTV,
      removeTV,
      connectionState,
      tvStatuses,
      startTvStatusPoll,
      stopTvStatusPoll,
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

function sendHello(channel: RealtimeChannel, token: string, profile: PlayerProfile) {
  const ev: ActionEvent = {
    kind: "hello",
    fromToken: token,
    playerId: profile.id,
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
