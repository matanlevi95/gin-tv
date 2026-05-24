import type { Card, PlayerId, RoundEndPayload } from "../../types";
import type { BasePlayer, GameAdapter } from "../common/types";
import {
  YanivGameState,
  YanivPlayerSlot,
  YANIV_DEFAULT_TARGET,
  callYaniv,
  createYanivState,
  dealYanivRound,
  discardGroup,
  drawFromDeck,
  drawFromDiscard,
  handValue,
  startNextRound,
} from "./engine";

export type YanivAction =
  | { kind: "discard_group"; cardIds: string[] }
  | { kind: "draw_deck" }
  | { kind: "draw_discard" }
  | { kind: "call_yaniv" };

export interface YanivPublic {
  roomCode: string;
  gameType: "yaniv";
  status: YanivGameState["status"];
  players: {
    id: PlayerId;
    name: string;
    avatar?: string;
    score: number;
    handCount: number;
    ready: boolean;
    connected: boolean;
  }[];
  currentTurn: PlayerId | null;
  turnPhase: YanivGameState["turnPhase"];
  deckCount: number;
  lastDiscardGroup: Card[];
  round: number;
  targetScore: number;
  lastAction?: YanivGameState["lastAction"];
}

export interface YanivPrivate {
  hand: Card[];
  handValue: number;
  canCallYaniv: boolean;
}

const errMsg = (code: string): string => ({
  NOT_YOUR_TURN: "זה לא התור שלך",
  WRONG_PHASE: "פעולה לא חוקית בשלב הזה",
  CARDS_NOT_IN_HAND: "אחד הקלפים לא נמצא בידך",
  ILLEGAL_GROUP: "צירוף הקלפים לא חוקי",
  EMPTY_DECK: "הקופה ריקה",
  EMPTY_DISCARD: "אין קלפים בזריקה",
  YANIV_TOO_HIGH: "אסור להכריז יניב מעל 7 נקודות",
  NOT_PLAYING: "המשחק לא פעיל",
}[code] || "אופס, משהו השתבש");

export const yanivAdapter: GameAdapter<YanivGameState, YanivPublic, YanivPrivate, YanivAction> = {
  type: "yaniv",

  createState(players: BasePlayer[], roomCode: string): YanivGameState {
    const state = createYanivState(roomCode);
    for (const p of players) {
      const slot: YanivPlayerSlot = {
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
    if (state.round === 0) dealYanivRound(state);
    else startNextRound(state);
  },

  getPublic(state) {
    return {
      roomCode: state.roomCode,
      gameType: "yaniv",
      status: state.status,
      players: state.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        handCount: p.hand.length,
        ready: p.ready,
        connected: p.connected,
      })),
      currentTurn:
        state.currentTurnIdx !== null ? state.players[state.currentTurnIdx]?.id ?? null : null,
      turnPhase: state.turnPhase,
      deckCount: state.deck.length,
      lastDiscardGroup: state.lastDiscardGroup.slice(),
      round: state.round,
      targetScore: state.targetScore,
      lastAction: state.lastAction,
    };
  },

  getPrivate(state, playerId) {
    const p = state.players.find((pp) => pp.id === playerId);
    if (!p) return { hand: [], handValue: 0, canCallYaniv: false };
    const v = handValue(p.hand);
    const isMyTurn =
      state.currentTurnIdx !== null && state.players[state.currentTurnIdx].id === playerId;
    return {
      hand: p.hand.slice(),
      handValue: v,
      canCallYaniv: isMyTurn && state.turnPhase === "discard" && v <= 7,
    };
  },

  handleAction(state, playerId, action) {
    switch (action.kind) {
      case "discard_group": {
        const err = discardGroup(state, playerId, action.cardIds);
        if (err) return { error: { code: err.code, message: errMsg(err.code) } };
        return { ok: true };
      }
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
      case "call_yaniv": {
        const res = callYaniv(state, playerId);
        if ("code" in res) return { error: { code: res.code, message: errMsg(res.code) } };
        // Convert YanivRoundEnd to the shared RoundEndPayload shape so the host
        // can broadcast it via the common channel — UI handles via `gameType`.
        const payload: RoundEndPayload = {
          winner: res.winner,
          reason: (res.reason === "yaniv" ? "knock" : "undercut") as any, // placeholder mapping for shared shape
          knocker: res.caller,
          hands: res.hands,
          melds: {},
          deadwood: res.handValues,
          pointsAwarded:
            res.pointsAwarded[res.winner] || res.pointsAwarded[res.caller] || 0,
          totals: res.totals,
          matchOver: res.matchOver,
        };
        // Attach a side-channel for UI to read the real reason cleanly.
        (payload as any).yaniv = res;
        return { ok: true, roundEnd: payload };
      }
    }
  },

  isMatchOver(state) {
    return state.status === "match_end";
  },
};
