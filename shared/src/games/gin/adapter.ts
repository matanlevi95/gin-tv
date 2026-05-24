/**
 * GameAdapter implementation for Gin Rummy.
 * Delegates to the existing engine (shared/src/game.ts, scoring.ts, melds.ts)
 * to preserve every existing behavior exactly. Only the wiring is new.
 */
import {
  GameRoomState,
  PlayerSlot,
  createRoomState,
  dealRound,
  drawFromDeck,
  drawFromDiscard,
  discard,
  declareKnockOrGin,
  reorderHand,
  startNextRound,
  publicState as ginPublic,
  privateHand as ginPrivate,
} from "../../game";
import type { Card, PlayerId, PrivateHandState, PublicGameState, RoundEndPayload } from "../../types";
import type { BasePlayer, GameAdapter } from "../common/types";

/** Gin-specific action payload sent over Realtime from a phone. */
export type GinAction =
  | { kind: "draw_deck" }
  | { kind: "draw_discard" }
  | { kind: "discard"; cardId: string }
  | { kind: "knock"; discardCardId: string }
  | { kind: "gin"; discardCardId: string }
  | { kind: "reorder_hand"; order: string[] };

/** Extended public state — same as the existing Gin engine's, plus `gameType`. */
export type GinPublic = PublicGameState & { gameType: "gin" };
export type GinPrivate = PrivateHandState;

const errMsg = (code: string): string => ({
  NOT_YOUR_TURN: "זה לא התור שלך",
  WRONG_PHASE: "פעולה לא חוקית בשלב הזה",
  EMPTY_DECK: "הקופה ריקה",
  EMPTY_DISCARD: "אין קלפים בזריקה",
  CARD_NOT_IN_HAND: "הקלף לא נמצא בידך",
  ILLEGAL_KNOCK: "אי אפשר להכריז נקישה כעת",
  ILLEGAL_GIN: "אי אפשר להכריז ג׳ין כעת",
  JUST_TOOK_FROM_DISCARD: "אסור לזרוק בחזרה את הקלף שהרגע לקחת מהזריקה",
  NOT_PLAYING: "המשחק לא פעיל",
}[code] || "אופס, משהו השתבש");

export const ginAdapter: GameAdapter<GameRoomState, GinPublic, GinPrivate, GinAction> = {
  type: "gin",

  createState(players: BasePlayer[], roomCode: string): GameRoomState {
    const state = createRoomState(roomCode);
    for (const p of players) {
      const slot: PlayerSlot = {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: 0,
        ready: !!p.ready,
        connected: !!p.connected,
        hand: [],
      };
      state.players.push(slot);
    }
    return state;
  },

  dealNewRound(state) {
    if (state.round === 0) {
      state.currentTurnIdx = 0;
      dealRound(state);
    } else {
      startNextRound(state);
    }
  },

  getPublic(state): GinPublic {
    return { ...ginPublic(state), gameType: "gin" };
  },

  getPrivate(state, playerId) {
    return ginPrivate(state, playerId);
  },

  handleAction(state, playerId, action) {
    switch (action.kind) {
      case "draw_deck": {
        const err = drawFromDeck(state, playerId);
        if (err) return { error: { code: err.code, message: errMsg(err.code) } };
        return { ok: true };
      }
      case "draw_discard": {
        const err = drawFromDiscard(state, playerId);
        if (err) return { error: { code: err.code, message: errMsg(err.code) } };
        return { ok: true };
      }
      case "discard": {
        const err = discard(state, playerId, action.cardId);
        if (err) return { error: { code: err.code, message: errMsg(err.code) } };
        // Engine may have cancelled the round (deck-exhaustion). Surface that.
        if (state.status === "round_end" && state.lastRoundEnd?.reason === "cancelled") {
          return { ok: true, roundEnd: state.lastRoundEnd };
        }
        return { ok: true };
      }
      case "knock":
      case "gin": {
        const res = declareKnockOrGin(state, playerId, action.discardCardId, action.kind);
        if ("code" in res) return { error: { code: res.code, message: errMsg(res.code) } };
        return { ok: true, roundEnd: res.payload };
      }
      case "reorder_hand": {
        reorderHand(state, playerId, action.order);
        return { ok: true };
      }
    }
  },

  isMatchOver(state) {
    return state.status === "match_end";
  },
};
