/**
 * Realtime transport protocol shared between TV (game host) and mobile (player client).
 *
 * Architecture: the TV browser is the authority — it holds room state, validates actions,
 * and broadcasts results. There is no central server. We use Supabase Realtime broadcast
 * channels purely as message bus.
 *
 * Channels:
 *   - gin:<roomCode>:room           — public events; TV broadcasts, everyone subscribes
 *   - gin:<roomCode>:player:<token> — private hand; TV broadcasts to one specific player.
 *                                     Each player's token is a 32-char secret known only
 *                                     to them and the TV. It's embedded in the QR code,
 *                                     so only the phone that scanned that QR can subscribe.
 *
 * Wire types are intentionally narrow so we can validate them at the receive boundary.
 */
import type {
  Card,
  PrivateHandState,
  PublicGameState,
  RoundEndPayload,
} from "./types";

export const PROTOCOL_VERSION = 1;

// ---------- Channel helpers ----------

export function roomChannel(roomCode: string): string {
  return `gin:${roomCode.toUpperCase()}:room`;
}

export function playerChannel(roomCode: string, token: string): string {
  return `gin:${roomCode.toUpperCase()}:player:${token}`;
}

// ---------- Player → Host (action) events ----------
// Sent by phones on the room channel. Host filters by `fromToken` to attribute to a player.

/** Game-agnostic envelope. Game-specific intents go inside `game_action.action`. */
export type ActionEvent =
  | {
      kind: "hello";
      /**
       * Phone-generated 32-char secret. Names the player's private channel so
       * only the holder can subscribe (channel name is the access key). The TV
       * also uses it as the per-player handle on subsequent actions.
       */
      fromToken: string;
      /** Stable, profile-bound player id (random uuid stored on the phone). */
      playerId: string;
      name: string;
      avatar?: string;
    }
  | { kind: "ready"; fromToken: string; ready: boolean }
  | { kind: "ready_next"; fromToken: string }
  /** Wraps a per-game action. `gameType` lets the host route to the right adapter. */
  | { kind: "game_action"; fromToken: string; gameType: "gin" | "yaniv"; action: unknown }
  // -- Legacy Gin actions (kept for backwards compatibility with old APKs in
  //    the wild; the new mobile builds use kind:"game_action" instead).
  | { kind: "draw_deck"; fromToken: string }
  | { kind: "draw_discard"; fromToken: string }
  | { kind: "discard"; fromToken: string; cardId: string }
  | { kind: "knock"; fromToken: string; discardCardId: string }
  | { kind: "gin"; fromToken: string; discardCardId: string }
  | { kind: "reorder_hand"; fromToken: string; order: string[] };

// ---------- Host → all (public) events ----------

export type PublicEvent =
  | { kind: "welcome"; toToken: string; playerId: string; roomCode: string }
  | { kind: "state"; payload: PublicGameState }
  | { kind: "round_end"; payload: RoundEndPayload }
  | { kind: "match_end"; winner: string; totals: Record<string, number> }
  | { kind: "game_start"; round: number }
  | { kind: "error"; toToken?: string; code: string; message: string }
  | { kind: "ping" }; // host heartbeat so phones can detect TV disconnection

// ---------- Host → one (private) events ----------

export type PrivateEvent =
  | { kind: "hand"; payload: PrivateHandState }
  | { kind: "joined"; playerId: string; roomCode: string };

// ---------- Token generation ----------

const TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generates a 32-char URL-safe token, the secret a phone needs in order to
 * subscribe to its private channel. Uses crypto when available, falling back
 * to Math.random — fine for our trust model (the secret only protects against
 * casual snooping; physical access to the TV reveals everything anyway).
 */
export function generatePlayerToken(): string {
  const bytes = new Uint8Array(32);
  const cryptoObj =
    (typeof globalThis !== "undefined" && (globalThis as any).crypto) ||
    undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

// ---------- QR payload ----------
//
// What the TV encodes in the QR. The phone parses this on scan.

/**
 * What the TV encodes in its QR (or what the user types as the 4-char "TV code").
 * Single QR per TV — the phone generates its own private token on connect.
 * `gameType` is encoded so the phone can route to the right controller screen
 * before any state arrives (snappier UX); the TV always confirms via state.
 */
export interface JoinPayload {
  v: number;
  room: string; // 4-char stable TV identifier
  gameType?: "gin" | "yaniv"; // optional for back-compat with older QRs
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function encodeJoinUrl(p: JoinPayload): string {
  const params = new URLSearchParams({
    v: String(p.v),
    room: p.room,
    url: p.supabaseUrl,
    key: p.supabaseAnonKey,
  });
  if (p.gameType) params.set("g", p.gameType);
  return `gin-tv://join?${params.toString()}`;
}

export function decodeJoinUrl(url: string): JoinPayload | null {
  try {
    const qIdx = url.indexOf("?");
    if (qIdx < 0) return null;
    const params = new URLSearchParams(url.substring(qIdx + 1));
    const v = parseInt(params.get("v") ?? "0", 10);
    const room = params.get("room");
    const supabaseUrl = params.get("url");
    const supabaseAnonKey = params.get("key");
    const g = params.get("g");
    if (!room || !supabaseUrl || !supabaseAnonKey) return null;
    return {
      v,
      room: room.toUpperCase(),
      gameType: g === "gin" || g === "yaniv" ? g : undefined,
      supabaseUrl,
      supabaseAnonKey,
    };
  } catch {
    return null;
  }
}
