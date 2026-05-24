/**
 * Generic RoomHost — game-agnostic authority that runs inside the TV browser.
 *
 * Owns:
 *   • The room code.
 *   • The seat assignment (up to 2 distinct playerIds).
 *   • The "ready" flow.
 *   • The Realtime broadcast plumbing.
 *
 * Delegates game logic to a `GameAdapter<S, Pub, Priv, Action>` which holds the
 * concrete state and answers public/private projections + action handling.
 *
 * Used identically by Gin and Yaniv (or any future game) — only the adapter changes.
 */
import { generateRoomCode } from "./room";
import {
  ActionEvent,
  PrivateEvent,
  PublicEvent,
} from "./realtime";
import { PlayerId, RoundEndPayload } from "./types";
import { BasePlayer, BasePublicState, GameAdapter, GameType } from "./games/common/types";
import { ginAdapter, GinAction } from "./games/gin/adapter";
import { yanivAdapter, YanivAction } from "./games/yaniv/adapter";

export interface HostBroadcast {
  emitPublic: (ev: PublicEvent) => void;
  emitPrivate: (toToken: string, ev: PrivateEvent) => void;
}

interface PlayerSlotMeta {
  playerId: PlayerId;
  token: string;
  name: string;
  avatar?: string;
}

/** Resolve a GameType to its adapter. */
function adapterFor(type: GameType): GameAdapter<any, BasePublicState, any, any> {
  switch (type) {
    case "gin":
      return ginAdapter as unknown as GameAdapter<any, BasePublicState, any, any>;
    case "yaniv":
      return yanivAdapter as unknown as GameAdapter<any, BasePublicState, any, any>;
  }
}

/**
 * Map the legacy flat Gin action envelopes (older mobile builds) onto the
 * GameAction shape. Lets a v0.2 phone keep playing against a v0.3 TV.
 */
function legacyToGinAction(ev: ActionEvent): GinAction | null {
  switch (ev.kind) {
    case "draw_deck":
      return { kind: "draw_deck" };
    case "draw_discard":
      return { kind: "draw_discard" };
    case "discard":
      return { kind: "discard", cardId: ev.cardId };
    case "knock":
      return { kind: "knock", discardCardId: ev.discardCardId };
    case "gin":
      return { kind: "gin", discardCardId: ev.discardCardId };
    case "reorder_hand":
      return { kind: "reorder_hand", order: ev.order };
    default:
      return null;
  }
}

export class RoomHost {
  readonly roomCode: string;
  readonly gameType: GameType;
  private adapter: GameAdapter<any, BasePublicState, any, any>;
  /** Game-specific state. Owned by the adapter; we never inspect it here. */
  private state: any;
  /** Lobby buffer for players before adapter.createState() is called on game start. */
  private lobbyPlayers: BasePlayer[] = [];
  private broadcast: HostBroadcast;
  private byPlayerId = new Map<PlayerId, PlayerSlotMeta>();
  private byToken = new Map<string, PlayerId>();
  private heartbeat?: ReturnType<typeof setInterval>;

  constructor(broadcast: HostBroadcast, opts: { roomCode?: string; gameType: GameType }) {
    this.roomCode = (opts.roomCode || generateRoomCode()).toUpperCase();
    this.gameType = opts.gameType;
    this.adapter = adapterFor(this.gameType);
    this.broadcast = broadcast;
    // Initial state is built lazily on first "deal" so seats can fill first.
    this.state = this.adapter.createState([], this.roomCode);
    this.heartbeat = setInterval(() => {
      this.broadcast.emitPublic({ kind: "ping" });
    }, 4000);
  }

  destroy() {
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  snapshotPublic(): BasePublicState {
    return this.adapter.getPublic(this.state);
  }

  emitState() {
    this.broadcast.emitPublic({
      kind: "state",
      payload: this.adapter.getPublic(this.state) as any,
    });
  }

  emitAllHands() {
    for (const meta of this.byPlayerId.values()) {
      const priv = this.adapter.getPrivate(this.state, meta.playerId);
      this.broadcast.emitPrivate(meta.token, { kind: "hand", payload: priv as any });
    }
  }

  handleAction(ev: ActionEvent) {
    if (ev.kind === "hello") return this.onHello(ev);
    if (ev.kind === "ready") return this.onReady(ev.fromToken, ev.ready);
    if (ev.kind === "ready_next") return this.onReady(ev.fromToken, true);

    // Route a game action through the adapter.
    const playerId = this.byToken.get(ev.fromToken);
    if (!playerId) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");

    let action: any = null;
    if (ev.kind === "game_action") {
      if (ev.gameType !== this.gameType) {
        return this.errTo(ev.fromToken, "WRONG_GAME", "המשחק הזה אינו פעיל בחדר");
      }
      action = ev.action;
    } else {
      // Legacy fallthrough: assume Gin (the only game with legacy actions).
      if (this.gameType !== "gin") {
        return this.errTo(ev.fromToken, "WRONG_GAME", "פעולה לא נתמכת במשחק הזה");
      }
      action = legacyToGinAction(ev);
      if (!action) return; // unknown event kind — ignore safely
    }

    const res = this.adapter.handleAction(this.state, playerId, action);
    if ("error" in res) {
      return this.errTo(ev.fromToken, res.error.code, res.error.message);
    }
    this.emitState();
    this.emitAllHands();
    if (res.roundEnd) {
      this.broadcast.emitPublic({ kind: "round_end", payload: res.roundEnd });
      if (res.roundEnd.matchOver) {
        const r = res.roundEnd;
        this.broadcast.emitPublic({
          kind: "match_end",
          winner: r.winner,
          totals: r.totals,
        });
      }
    }
  }

  private onHello(ev: Extract<ActionEvent, { kind: "hello" }>) {
    const existing = this.byPlayerId.get(ev.playerId);
    if (existing) {
      // Reconnect — refresh token, restore connectivity, refresh name/avatar.
      this.byToken.delete(existing.token);
      existing.token = ev.fromToken;
      existing.name = ev.name || existing.name;
      if (ev.avatar) existing.avatar = ev.avatar;
      this.byToken.set(ev.fromToken, ev.playerId);
      // Mark connected in whichever state representation is active.
      const players = this.state.players as Array<{ id: string; connected: boolean; name: string; avatar?: string }>;
      const slot = players.find((p) => p.id === ev.playerId);
      if (slot) {
        slot.connected = true;
        slot.name = existing.name;
        if (existing.avatar) slot.avatar = existing.avatar;
      } else {
        // Also update lobby buffer (pre-game).
        const lp = this.lobbyPlayers.find((p) => p.id === ev.playerId);
        if (lp) {
          lp.connected = true;
          lp.name = existing.name;
          if (existing.avatar) lp.avatar = existing.avatar;
        }
      }
      this.broadcast.emitPrivate(ev.fromToken, {
        kind: "joined",
        playerId: ev.playerId,
        roomCode: this.roomCode,
      });
      this.emitState();
      this.emitAllHands();
      return;
    }
    // New player — claim a seat if one is open.
    const totalPlayers = this.state.players.length || this.lobbyPlayers.length;
    if (totalPlayers >= 2) {
      this.errTo(ev.fromToken, "ROOM_FULL", "החדר מלא");
      return;
    }
    const meta: PlayerSlotMeta = {
      playerId: ev.playerId,
      token: ev.fromToken,
      name: ev.name || "אורח",
      avatar: ev.avatar,
    };
    this.byPlayerId.set(ev.playerId, meta);
    this.byToken.set(ev.fromToken, ev.playerId);
    // Add to whichever state representation is active.
    const player: BasePlayer = {
      id: ev.playerId,
      name: meta.name,
      avatar: meta.avatar,
      score: 0,
      ready: false,
      connected: true,
    };
    if (this.state.players.length > 0 || this.state.status !== "lobby") {
      // already-running game shouldn't normally accept new players — defensive.
      this.state.players.push({ ...player, hand: [] });
    } else {
      this.lobbyPlayers.push(player);
      // Re-create state with the updated lobby so the adapter sees both players.
      this.state = this.adapter.createState(this.lobbyPlayers, this.roomCode);
    }
    this.broadcast.emitPrivate(ev.fromToken, {
      kind: "joined",
      playerId: ev.playerId,
      roomCode: this.roomCode,
    });
    this.emitState();
  }

  private onReady(fromToken: string, ready: boolean) {
    const playerId = this.byToken.get(fromToken);
    if (!playerId) return;
    const slot = this.state.players.find((p: any) => p.id === playerId);
    if (slot) slot.ready = ready;
    const lp = this.lobbyPlayers.find((p) => p.id === playerId);
    if (lp) lp.ready = ready;
    this.emitState();
    const everyone = this.state.players.length === 2 && this.state.players.every((p: any) => p.ready);
    const lobbyReady = this.state.players.length === 0 && this.lobbyPlayers.length === 2 && this.lobbyPlayers.every((p) => p.ready);
    const canStart =
      (this.state.status === "lobby" || this.state.status === "round_end") &&
      (everyone || lobbyReady);
    if (canStart) {
      if (this.state.players.length === 0) {
        // Promote lobby buffer into actual state before dealing.
        this.state = this.adapter.createState(this.lobbyPlayers, this.roomCode);
      }
      this.adapter.dealNewRound(this.state);
      this.broadcast.emitPublic({ kind: "game_start", round: this.state.round });
      this.emitState();
      this.emitAllHands();
    }
  }

  private errTo(token: string, code: string, message: string) {
    this.broadcast.emitPublic({ kind: "error", toToken: token, code, message });
  }
}
