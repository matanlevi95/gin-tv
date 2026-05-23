/**
 * RoomHost — game authority that runs inside the TV browser.
 *
 * Holds the room's GameRoomState, processes incoming ActionEvents from phones,
 * and emits PublicEvent / PrivateEvent through callbacks the caller wires to
 * Supabase channels. No DB, no server — broadcast-only.
 *
 * Connection model (single-QR):
 *   - The TV has a stable 4-char roomCode (persisted in localStorage).
 *   - The QR encodes (roomCode, supabaseUrl, supabaseAnonKey) — no per-seat token.
 *   - Each phone generates its OWN privateToken on connect and sends it in
 *     hello{}. The TV uses that token to address private hand updates back to
 *     the phone via the per-player channel `gin:<code>:player:<token>`.
 *   - Up to 2 distinct playerIds are accepted. A repeat hello from the same
 *     playerId is treated as a reconnect (token can be refreshed).
 */
import {
  GameRoomState,
  PlayerSlot,
  createRoomState,
  dealRound,
  drawFromDeck,
  drawFromDiscard,
  discard as gameDiscard,
  declareKnockOrGin,
  reorderHand,
  startNextRound,
  allReady,
  publicState,
  privateHand,
} from "./game";
import { generateRoomCode } from "./room";
import {
  ActionEvent,
  PrivateEvent,
  PublicEvent,
} from "./realtime";
import { PlayerId } from "./types";

export interface HostBroadcast {
  /** Send to everyone subscribed to the room channel. */
  emitPublic: (ev: PublicEvent) => void;
  /** Send to a single player via their private channel (named by their token). */
  emitPrivate: (toToken: string, ev: PrivateEvent) => void;
}

/** Server-side knowledge of which phone owns which seat. */
interface PlayerSlotMeta {
  playerId: PlayerId;
  token: string; // latest private channel token for this player
}

export class RoomHost {
  readonly roomCode: string;
  private state: GameRoomState;
  private broadcast: HostBroadcast;
  /** playerId → meta (token, etc.) */
  private byPlayerId = new Map<PlayerId, PlayerSlotMeta>();
  /** token → playerId for fast lookup on action events */
  private byToken = new Map<string, PlayerId>();
  private heartbeat?: ReturnType<typeof setInterval>;

  constructor(broadcast: HostBroadcast, roomCode?: string) {
    this.roomCode = (roomCode || generateRoomCode()).toUpperCase();
    this.state = createRoomState(this.roomCode);
    this.broadcast = broadcast;
    this.heartbeat = setInterval(() => {
      this.broadcast.emitPublic({ kind: "ping" });
    }, 4000);
  }

  destroy() {
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  snapshotPublic() {
    return publicState(this.state);
  }

  emitState() {
    this.broadcast.emitPublic({ kind: "state", payload: publicState(this.state) });
  }

  emitAllHands() {
    for (const meta of this.byPlayerId.values()) {
      const priv = privateHand(this.state, meta.playerId);
      this.broadcast.emitPrivate(meta.token, { kind: "hand", payload: priv });
    }
  }

  handleAction(ev: ActionEvent) {
    switch (ev.kind) {
      case "hello":
        this.onHello(ev);
        return;
      case "ready":
        this.onReady(ev.fromToken, ev.ready);
        return;
      case "ready_next":
        this.onReady(ev.fromToken, true);
        return;
      case "draw_deck": {
        const playerId = this.byToken.get(ev.fromToken);
        if (!playerId) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const err = drawFromDeck(this.state, playerId);
        if (err) return this.errTo(ev.fromToken, err.code, errMsg(err.code));
        this.emitState();
        this.emitAllHands();
        return;
      }
      case "draw_discard": {
        const playerId = this.byToken.get(ev.fromToken);
        if (!playerId) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const err = drawFromDiscard(this.state, playerId);
        if (err) return this.errTo(ev.fromToken, err.code, errMsg(err.code));
        this.emitState();
        this.emitAllHands();
        return;
      }
      case "discard": {
        const playerId = this.byToken.get(ev.fromToken);
        if (!playerId) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const err = gameDiscard(this.state, playerId, ev.cardId);
        if (err) return this.errTo(ev.fromToken, err.code, errMsg(err.code));
        this.emitState();
        this.emitAllHands();
        return;
      }
      case "knock":
      case "gin": {
        const playerId = this.byToken.get(ev.fromToken);
        if (!playerId) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const res = declareKnockOrGin(
          this.state,
          playerId,
          ev.discardCardId,
          ev.kind
        );
        if ("code" in res) {
          return this.errTo(ev.fromToken, res.code, errMsg(res.code));
        }
        this.emitState();
        this.emitAllHands();
        this.broadcast.emitPublic({ kind: "round_end", payload: res.payload });
        if (res.matchOver) {
          const totals: Record<string, number> = {};
          let winner = this.state.players[0]?.id ?? "";
          let max = -1;
          for (const pl of this.state.players) {
            totals[pl.id] = pl.score;
            if (pl.score > max) {
              max = pl.score;
              winner = pl.id;
            }
          }
          this.broadcast.emitPublic({ kind: "match_end", winner, totals });
        }
        return;
      }
      case "reorder_hand": {
        const playerId = this.byToken.get(ev.fromToken);
        if (!playerId) return;
        reorderHand(this.state, playerId, ev.order);
        const priv = privateHand(this.state, playerId);
        this.broadcast.emitPrivate(ev.fromToken, { kind: "hand", payload: priv });
        return;
      }
    }
  }

  /** Phones report they're connected (or reconnecting) with their stable playerId + fresh privateToken. */
  private onHello(ev: Extract<ActionEvent, { kind: "hello" }>) {
    const existing = this.byPlayerId.get(ev.playerId);
    if (existing) {
      // Reconnect — refresh token, restore connectivity, refresh name/avatar.
      this.byToken.delete(existing.token);
      existing.token = ev.fromToken;
      this.byToken.set(ev.fromToken, ev.playerId);
      const slot = this.state.players.find((p) => p.id === ev.playerId);
      if (slot) {
        slot.connected = true;
        slot.name = ev.name || slot.name;
        if (ev.avatar) slot.avatar = ev.avatar;
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
    if (this.state.players.length >= 2) {
      this.errTo(ev.fromToken, "ROOM_FULL", "החדר מלא");
      return;
    }
    const slot: PlayerSlot = {
      id: ev.playerId,
      name: ev.name || "אורח",
      avatar: ev.avatar,
      score: 0,
      ready: false,
      connected: true,
      hand: [],
    };
    this.state.players.push(slot);
    this.byPlayerId.set(ev.playerId, { playerId: ev.playerId, token: ev.fromToken });
    this.byToken.set(ev.fromToken, ev.playerId);
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
    const slot = this.state.players.find((p) => p.id === playerId);
    if (!slot) return;
    slot.ready = ready;
    this.emitState();
    if (
      (this.state.status === "lobby" || this.state.status === "round_end") &&
      allReady(this.state)
    ) {
      if (this.state.round === 0) {
        this.state.currentTurnIdx = 0;
        dealRound(this.state);
      } else {
        startNextRound(this.state);
      }
      this.broadcast.emitPublic({ kind: "game_start", round: this.state.round });
      this.emitState();
      this.emitAllHands();
    }
  }

  private errTo(token: string, code: string, message: string) {
    this.broadcast.emitPublic({ kind: "error", toToken: token, code, message });
  }
}

function errMsg(code: string): string {
  switch (code) {
    case "NOT_YOUR_TURN":
      return "זה לא התור שלך";
    case "WRONG_PHASE":
      return "פעולה לא חוקית בשלב הזה";
    case "EMPTY_DECK":
      return "הקופה ריקה";
    case "EMPTY_DISCARD":
      return "אין קלפים בזריקה";
    case "CARD_NOT_IN_HAND":
      return "הקלף לא נמצא בידך";
    case "ILLEGAL_KNOCK":
      return "אי אפשר להכריז נקישה כעת";
    case "ILLEGAL_GIN":
      return "אי אפשר להכריז ג׳ין כעת";
    case "JUST_TOOK_FROM_DISCARD":
      return "אסור לזרוק בחזרה את הקלף שהרגע לקחת מהזריקה";
    default:
      return "אופס, משהו השתבש";
  }
}
