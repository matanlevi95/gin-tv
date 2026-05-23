/**
 * RoomHost — game authority that runs inside the TV browser.
 *
 * Holds the room's GameRoomState, processes incoming ActionEvents from phones,
 * and emits PublicEvent / PrivateEvent through callbacks the caller wires to
 * Supabase channels. No DB, no server — broadcast-only.
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
  generatePlayerToken,
  PrivateEvent,
  PublicEvent,
} from "./realtime";
import { PlayerId } from "./types";

export interface HostBroadcast {
  /** Send to everyone in the room (public state, errors visible to all, round_end). */
  emitPublic: (ev: PublicEvent) => void;
  /** Send to a single player via their private channel. */
  emitPrivate: (toToken: string, ev: PrivateEvent) => void;
  /** Send a public error addressed to one player (visible to all but intended for one). */
  emitErrorTo?: (toToken: string, code: string, message: string) => void;
}

interface PlayerSlotMeta {
  token: string;
  playerId: PlayerId;
}

export class RoomHost {
  readonly roomCode: string;
  private state: GameRoomState;
  private broadcast: HostBroadcast;
  /** Maps token → playerId so we can look up the player from incoming actions. */
  private byToken = new Map<string, PlayerSlotMeta>();
  /** Two pre-generated tokens (one per seat) so we can build QR codes before anyone joins. */
  readonly slotTokens: [string, string];
  private heartbeat?: ReturnType<typeof setInterval>;

  constructor(broadcast: HostBroadcast, roomCode?: string) {
    this.roomCode = (roomCode || generateRoomCode()).toUpperCase();
    this.state = createRoomState(this.roomCode);
    this.broadcast = broadcast;
    this.slotTokens = [generatePlayerToken(), generatePlayerToken()];
    // Broadcast a heartbeat every 5s so phones can detect a dead host.
    this.heartbeat = setInterval(() => {
      this.broadcast.emitPublic({ kind: "ping" });
    }, 5000);
  }

  destroy() {
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  /** Token for the Nth seat (0 or 1). Used when building QR codes. */
  tokenForSlot(slot: 0 | 1): string {
    return this.slotTokens[slot];
  }

  /** Returns the current public state snapshot. Useful for late re-broadcasts. */
  snapshotPublic() {
    return publicState(this.state);
  }

  /** Broadcasts the current public state to everyone. */
  emitState() {
    this.broadcast.emitPublic({ kind: "state", payload: publicState(this.state) });
  }

  /** Broadcasts each player's private hand to their own channel. */
  emitAllHands() {
    for (const meta of this.byToken.values()) {
      const priv = privateHand(this.state, meta.playerId);
      const token = meta.token;
      this.broadcast.emitPrivate(token, { kind: "hand", payload: priv });
    }
  }

  /** Handles an action coming from a phone over the room channel. */
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
        const p = this.byToken.get(ev.fromToken);
        if (!p) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const err = drawFromDeck(this.state, p.playerId);
        if (err) return this.errTo(ev.fromToken, err.code, errMsg(err.code));
        this.emitState();
        this.emitAllHands();
        return;
      }
      case "draw_discard": {
        const p = this.byToken.get(ev.fromToken);
        if (!p) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const err = drawFromDiscard(this.state, p.playerId);
        if (err) return this.errTo(ev.fromToken, err.code, errMsg(err.code));
        this.emitState();
        this.emitAllHands();
        return;
      }
      case "discard": {
        const p = this.byToken.get(ev.fromToken);
        if (!p) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const err = gameDiscard(this.state, p.playerId, ev.cardId);
        if (err) return this.errTo(ev.fromToken, err.code, errMsg(err.code));
        this.emitState();
        this.emitAllHands();
        return;
      }
      case "knock":
      case "gin": {
        const p = this.byToken.get(ev.fromToken);
        if (!p) return this.errTo(ev.fromToken, "UNKNOWN_PLAYER", "השחקן לא בחדר");
        const res = declareKnockOrGin(
          this.state,
          p.playerId,
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
        const p = this.byToken.get(ev.fromToken);
        if (!p) return;
        reorderHand(this.state, p.playerId, ev.order);
        const priv = privateHand(this.state, p.playerId);
        this.broadcast.emitPrivate(ev.fromToken, { kind: "hand", payload: priv });
        return;
      }
    }
  }

  // ---- internal ----

  private onHello(ev: Extract<ActionEvent, { kind: "hello" }>) {
    let existing = this.byToken.get(ev.fromToken);
    if (existing) {
      // reconnect: update name/avatar, mark connected
      const slot = this.state.players.find((pp) => pp.id === existing!.playerId);
      if (slot) {
        slot.name = ev.name || slot.name;
        if (ev.avatar) slot.avatar = ev.avatar;
        slot.connected = true;
      }
      this.broadcast.emitPrivate(ev.fromToken, {
        kind: "joined",
        playerId: existing.playerId,
        roomCode: this.roomCode,
      });
      this.emitState();
      this.emitAllHands();
      return;
    }
    // Assign to the first free slot (matching this token).
    const slotIdx = this.slotTokens.indexOf(ev.fromToken) as 0 | 1 | -1;
    if (slotIdx < 0) {
      return this.errTo(ev.fromToken, "BAD_TOKEN", "טוקן לא תקין");
    }
    if (this.state.players.length >= 2) {
      // already 2 players; reject extra connections to slot tokens that were already used.
      return this.errTo(ev.fromToken, "ROOM_FULL", "החדר מלא");
    }
    const playerId = `p_${ev.fromToken.substring(0, 8)}`;
    const slot: PlayerSlot = {
      id: playerId,
      name: ev.name || "אורח",
      avatar: ev.avatar,
      score: 0,
      ready: false,
      connected: true,
      hand: [],
    };
    this.state.players.push(slot);
    this.byToken.set(ev.fromToken, { token: ev.fromToken, playerId });
    this.broadcast.emitPrivate(ev.fromToken, {
      kind: "joined",
      playerId,
      roomCode: this.roomCode,
    });
    this.emitState();
  }

  private onReady(fromToken: string, ready: boolean) {
    const meta = this.byToken.get(fromToken);
    if (!meta) return;
    const slot = this.state.players.find((p) => p.id === meta.playerId);
    if (!slot) return;
    slot.ready = ready;
    this.emitState();
    // If both ready and we're in lobby or round_end, deal.
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
    if (this.broadcast.emitErrorTo) {
      this.broadcast.emitErrorTo(token, code, message);
    } else {
      this.broadcast.emitPublic({ kind: "error", toToken: token, code, message });
    }
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
    default:
      return "אופס, משהו השתבש";
  }
}
