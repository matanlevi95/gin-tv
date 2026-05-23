import { buildDeck, shuffle } from "./cards";
import { bestArrangement } from "./melds";
import {
  scoreRound,
  KNOCK_MAX_DEADWOOD,
  DEFAULT_TARGET_SCORE,
  GAME_BONUS,
  SHUTOUT_BONUS,
} from "./scoring";
import {
  Card,
  GameActionLog,
  Meld,
  PlayerId,
  PrivateHandState,
  PublicGameState,
  RoundEndPayload,
  TurnPhase,
} from "./types";

export interface PlayerSlot {
  id: PlayerId;
  name: string;
  avatar?: string;
  score: number;
  ready: boolean;
  connected: boolean;
  hand: Card[];
}

export interface GameRoomState {
  roomCode: string;
  status: "lobby" | "playing" | "round_end" | "match_end";
  players: PlayerSlot[]; // exactly 2 once full
  deck: Card[];
  discard: Card[];
  currentTurnIdx: 0 | 1 | null;
  turnPhase: TurnPhase | null;
  round: number;
  targetScore: number;
  turnDeadlineMs: number | null;
  /**
   * The card the current player just took from the discard pile this turn.
   * Cleared when the player draws from the deck or after they finish discarding.
   * Used to enforce: you can't take a card off the discard pile and immediately
   * put it back the same turn (per Pagat rules).
   */
  justTookFromDiscard: Card | null;
  lastAction?: GameActionLog;
  lastRoundEnd?: RoundEndPayload;
}

export function createRoomState(roomCode: string): GameRoomState {
  return {
    roomCode,
    status: "lobby",
    players: [],
    deck: [],
    discard: [],
    currentTurnIdx: null,
    turnPhase: null,
    round: 0,
    targetScore: DEFAULT_TARGET_SCORE,
    turnDeadlineMs: null,
    justTookFromDiscard: null,
  };
}

export function publicState(state: GameRoomState, now = Date.now()): PublicGameState {
  return {
    roomCode: state.roomCode,
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
    discardTop: state.discard.length ? state.discard[state.discard.length - 1] : null,
    discardCount: state.discard.length,
    round: state.round,
    targetScore: state.targetScore,
    turnDeadlineMs: state.turnDeadlineMs,
    lastAction: state.lastAction,
  };
}

export function privateHand(state: GameRoomState, playerId: PlayerId): PrivateHandState {
  const p = state.players.find((pp) => pp.id === playerId);
  if (!p) return { hand: [], deadwood: 0, melds: [], canKnock: false, canGin: false };
  // Only meaningful during/after a draw. We still expose deadwood for the current hand size.
  const arr = bestArrangement(p.hand);
  const isMyTurn =
    state.currentTurnIdx !== null && state.players[state.currentTurnIdx].id === playerId;
  // Can knock/gin only after drawing (11 cards) before discarding
  const after_draw = isMyTurn && state.turnPhase === "discard" && p.hand.length === 11;
  return {
    hand: p.hand,
    deadwood: arr.deadwood,
    melds: arr.melds,
    canKnock: after_draw && arr.deadwood <= KNOCK_MAX_DEADWOOD,
    canGin: after_draw && arr.deadwood === 0,
  };
}

export function dealRound(state: GameRoomState, rng: () => number = Math.random) {
  if (state.players.length !== 2) throw new Error("need 2 players to deal");
  const deck = shuffle(buildDeck(), rng);
  for (const p of state.players) p.hand = [];
  // Alternate deal 10 each
  for (let i = 0; i < 20; i++) {
    const card = deck.pop()!;
    state.players[i % 2].hand.push(card);
  }
  const upcard = deck.pop()!;
  state.deck = deck;
  state.discard = [upcard];
  state.round += 1;
  if (state.currentTurnIdx === null) state.currentTurnIdx = 0;
  state.turnPhase = "draw";
  state.status = "playing";
  state.justTookFromDiscard = null;
  state.lastAction = { kind: "deal", at: Date.now() };
}

// ---------- Player action handlers (return error code or null) ----------

export type ActionError =
  | { code: "NOT_YOUR_TURN" }
  | { code: "WRONG_PHASE" }
  | { code: "EMPTY_DECK" }
  | { code: "EMPTY_DISCARD" }
  | { code: "CARD_NOT_IN_HAND" }
  | { code: "ILLEGAL_KNOCK" }
  | { code: "ILLEGAL_GIN" }
  | { code: "JUST_TOOK_FROM_DISCARD" }
  | { code: "NOT_PLAYING" };

function currentPlayer(state: GameRoomState): PlayerSlot | null {
  if (state.currentTurnIdx === null) return null;
  return state.players[state.currentTurnIdx];
}

function checkTurn(state: GameRoomState, playerId: PlayerId, phase: TurnPhase): ActionError | null {
  if (state.status !== "playing") return { code: "NOT_PLAYING" };
  const cp = currentPlayer(state);
  if (!cp || cp.id !== playerId) return { code: "NOT_YOUR_TURN" };
  if (state.turnPhase !== phase) return { code: "WRONG_PHASE" };
  return null;
}

export function drawFromDeck(state: GameRoomState, playerId: PlayerId): ActionError | null {
  const err = checkTurn(state, playerId, "draw");
  if (err) return err;
  if (state.deck.length === 0) return { code: "EMPTY_DECK" };
  const card = state.deck.pop()!;
  currentPlayer(state)!.hand.push(card);
  state.turnPhase = "discard";
  state.justTookFromDiscard = null;
  state.lastAction = { kind: "draw_deck", by: playerId, at: Date.now() };
  return null;
}

export function drawFromDiscard(state: GameRoomState, playerId: PlayerId): ActionError | null {
  const err = checkTurn(state, playerId, "draw");
  if (err) return err;
  if (state.discard.length === 0) return { code: "EMPTY_DISCARD" };
  const card = state.discard.pop()!;
  currentPlayer(state)!.hand.push(card);
  state.turnPhase = "discard";
  state.justTookFromDiscard = card;
  state.lastAction = { kind: "draw_discard", by: playerId, card, at: Date.now() };
  return null;
}

export function discard(state: GameRoomState, playerId: PlayerId, cardId: string): ActionError | null {
  const err = checkTurn(state, playerId, "discard");
  if (err) return err;
  // Pagat rule: can't take a card off the discard pile and immediately put the same card back.
  if (state.justTookFromDiscard && state.justTookFromDiscard.id === cardId) {
    return { code: "JUST_TOOK_FROM_DISCARD" };
  }
  const p = currentPlayer(state)!;
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { code: "CARD_NOT_IN_HAND" };
  const [card] = p.hand.splice(idx, 1);
  state.discard.push(card);
  state.lastAction = { kind: "discard", by: playerId, card, at: Date.now() };
  state.justTookFromDiscard = null;
  // pass turn
  state.currentTurnIdx = (state.currentTurnIdx === 0 ? 1 : 0) as 0 | 1;
  state.turnPhase = "draw";
  // Pagat: if the deck is reduced to 2 cards after a discard (and no knock/gin),
  // the round is cancelled — same dealer redeals, no score change.
  if (state.deck.length <= 2) {
    cancelRoundDueToDeckExhaustion(state);
  }
  return null;
}

function cancelRoundDueToDeckExhaustion(state: GameRoomState) {
  state.status = "round_end";
  state.turnPhase = null;
  state.justTookFromDiscard = null;
  const p0 = state.players[0];
  const p1 = state.players[1];
  state.lastRoundEnd = {
    winner: "",
    reason: "cancelled",
    hands: { [p0.id]: p0.hand.slice(), [p1.id]: p1.hand.slice() },
    melds: { [p0.id]: [], [p1.id]: [] },
    deadwood: { [p0.id]: 0, [p1.id]: 0 },
    pointsAwarded: 0,
    totals: { [p0.id]: p0.score, [p1.id]: p1.score },
    matchOver: false,
  };
  for (const p of state.players) p.ready = false;
}

export function reorderHand(state: GameRoomState, playerId: PlayerId, order: string[]): ActionError | null {
  const p = state.players.find((pp) => pp.id === playerId);
  if (!p) return { code: "CARD_NOT_IN_HAND" };
  const map = new Map(p.hand.map((c) => [c.id, c]));
  if (order.length !== p.hand.length) return { code: "CARD_NOT_IN_HAND" };
  const next: Card[] = [];
  for (const id of order) {
    const c = map.get(id);
    if (!c) return { code: "CARD_NOT_IN_HAND" };
    next.push(c);
  }
  p.hand = next;
  return null;
}

export interface DeclareResult {
  payload: RoundEndPayload;
  matchOver: boolean;
}

export function declareKnockOrGin(
  state: GameRoomState,
  playerId: PlayerId,
  discardCardId: string,
  declaration: "knock" | "gin"
): ActionError | DeclareResult {
  const err = checkTurn(state, playerId, "discard");
  if (err) return err;
  const p = currentPlayer(state)!;
  const oppIdx = (state.currentTurnIdx === 0 ? 1 : 0) as 0 | 1;
  const opp = state.players[oppIdx];

  const idx = p.hand.findIndex((c) => c.id === discardCardId);
  if (idx < 0) return { code: "CARD_NOT_IN_HAND" };
  const [discardCard] = p.hand.splice(idx, 1);
  // Now p.hand has 10 cards (the laid-down hand)
  const arr = bestArrangement(p.hand);
  if (declaration === "gin" && arr.deadwood !== 0) {
    // restore
    p.hand.splice(idx, 0, discardCard);
    return { code: "ILLEGAL_GIN" };
  }
  if (declaration === "knock" && arr.deadwood > KNOCK_MAX_DEADWOOD) {
    p.hand.splice(idx, 0, discardCard);
    return { code: "ILLEGAL_KNOCK" };
  }
  state.discard.push(discardCard);
  state.justTookFromDiscard = null;

  const round = scoreRound({
    knockerHand: p.hand,
    opponentHand: opp.hand,
    declaration,
  });

  const winnerId = round.winner === "knocker" ? p.id : opp.id;
  const loserId = round.winner === "knocker" ? opp.id : p.id;
  const winnerSlot = state.players.find((x) => x.id === winnerId)!;
  const loserSlot = state.players.find((x) => x.id === loserId)!;
  winnerSlot.score += round.points;

  // End-of-match bonuses (canonical Bicycle / Wikipedia rules):
  //   • Game bonus: +100 to the match winner for reaching the target first.
  //   • Shutout (skunk) bonus: an additional +100 if the loser ends with 0.
  // We record them in `bonuses` so the UI can show "+100 ניצחון משחק" separately.
  const matchOver = winnerSlot.score >= state.targetScore;
  let gameBonus = 0;
  let shutoutBonus = 0;
  if (matchOver) {
    gameBonus = GAME_BONUS;
    winnerSlot.score += gameBonus;
    if (loserSlot.score === 0) {
      shutoutBonus = SHUTOUT_BONUS;
      winnerSlot.score += shutoutBonus;
    }
  }
  state.status = matchOver ? "match_end" : "round_end";
  state.turnPhase = null;

  const payload: RoundEndPayload = {
    winner: winnerId,
    reason: round.reason,
    knocker: p.id,
    hands: {
      [p.id]: p.hand.slice(),
      [opp.id]: opp.hand.slice(),
    },
    melds: {
      [p.id]: round.knockerArrangement.melds,
      [opp.id]: round.opponentArrangement.melds,
    },
    deadwood: {
      [p.id]: round.knockerDeadwood,
      [opp.id]: round.opponentDeadwoodAfter,
    },
    pointsAwarded: round.points,
    bonuses: matchOver ? { gameBonus, shutoutBonus } : undefined,
    totals: {
      [state.players[0].id]: state.players[0].score,
      [state.players[1].id]: state.players[1].score,
    },
    matchOver,
  };

  state.lastRoundEnd = payload;
  state.lastAction = {
    kind: round.reason,
    by: playerId,
    card: discardCard,
    at: Date.now(),
  };

  // reset ready flags so both must press "ready" for next round
  for (const pl of state.players) pl.ready = false;

  return { payload, matchOver };
}

export function startNextRound(state: GameRoomState, rng?: () => number) {
  if (state.players.length !== 2) return;
  // Alternate dealer/first turn: loser of last round leads, falling back to round parity.
  if (state.lastRoundEnd) {
    const loserId =
      state.lastRoundEnd.winner === state.players[0].id ? state.players[1].id : state.players[0].id;
    state.currentTurnIdx = (state.players[0].id === loserId ? 0 : 1) as 0 | 1;
  } else {
    state.currentTurnIdx = 0;
  }
  dealRound(state, rng);
}

export function allReady(state: GameRoomState): boolean {
  return state.players.length === 2 && state.players.every((p) => p.ready);
}
