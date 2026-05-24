/**
 * Yaniv engine — Israeli card game, 2-player MVP.
 *
 * Rules implemented:
 *   • 52-card deck, 5 cards per player, one face-up discard.
 *   • Each turn: discard a legal group, then draw one card (deck or discard top of last group).
 *   • Legal discards: a single card, a same-rank set (2-4 cards), or a same-suit run of 3+ cards.
 *   • A player whose hand value is ≤ 7 may CALL "YANIV" at the start of their
 *     turn (instead of discarding/drawing).
 *   • Scoring:
 *       - Successful Yaniv: caller scores 0, opponent scores their hand value.
 *       - Assaf (opponent's hand value ≤ caller's): caller gets +30 + caller hand value,
 *         opponent scores 0.
 *   • Match end: a player who reaches the target (default 100) LOSES the match.
 *
 * Card values (Yaniv-specific!):
 *   A = 1; 2..10 = face value; J, Q, K = 10. (Same as Gin in our implementation.)
 *
 * Notes/simplifications for the MVP:
 *   • No jokers.
 *   • No "second-chance" pickup from any position in the discarded group — phone
 *     can only draw from the deck or the top card of the most recent discard group.
 *   • No "score reset" rule (some variants reset at 50/100 — not implemented).
 *   • First turn: lower-id player goes first; subsequent rounds rotate.
 */
import type { Card, PlayerId, Rank, Suit } from "../../types";
import { buildDeck, cardValue, RANK_ORDER, shuffle } from "../../cards";

export interface YanivPlayerSlot {
  id: PlayerId;
  name: string;
  avatar?: string;
  score: number;
  ready: boolean;
  connected: boolean;
  hand: Card[];
}

export interface YanivGameState {
  roomCode: string;
  status: "lobby" | "playing" | "round_end" | "match_end";
  players: YanivPlayerSlot[];
  deck: Card[];
  /**
   * The most recently discarded GROUP (face-up). The drawable top-of-discard is
   * the LAST card of this group (some variants allow ends of the group; we pick
   * just one for simplicity).
   */
  lastDiscardGroup: Card[];
  currentTurnIdx: 0 | 1 | null;
  /**
   * Two phases per turn:
   *   "discard"  — player must lay down a legal group, OR call Yaniv.
   *   "draw"     — having discarded, player must draw one card to refill.
   */
  turnPhase: "discard" | "draw" | null;
  round: number;
  targetScore: number;
  lastAction?: { kind: string; by?: PlayerId; card?: Card; at: number };
  lastRoundEnd?: YanivRoundEnd;
}

export interface YanivRoundEnd {
  reason: "yaniv" | "assaf";
  caller: PlayerId;
  winner: PlayerId; // caller if reason=yaniv, opponent if reason=assaf
  hands: Record<PlayerId, Card[]>;
  handValues: Record<PlayerId, number>;
  pointsAwarded: Record<PlayerId, number>;
  totals: Record<PlayerId, number>;
  matchOver: boolean;
}

export const YANIV_DEFAULT_TARGET = 100;
export const YANIV_THRESHOLD = 7;
export const ASSAF_BONUS = 30;

export function createYanivState(roomCode: string): YanivGameState {
  return {
    roomCode,
    status: "lobby",
    players: [],
    deck: [],
    lastDiscardGroup: [],
    currentTurnIdx: null,
    turnPhase: null,
    round: 0,
    targetScore: YANIV_DEFAULT_TARGET,
  };
}

export function handValue(hand: Card[]): number {
  let sum = 0;
  for (const c of hand) sum += cardValue(c.rank);
  return sum;
}

export function dealYanivRound(state: YanivGameState, rng: () => number = Math.random) {
  if (state.players.length !== 2) throw new Error("yaniv needs 2 players");
  const deck = shuffle(buildDeck(), rng);
  for (const p of state.players) p.hand = [];
  for (let i = 0; i < 10; i++) {
    state.players[i % 2].hand.push(deck.pop()!);
  }
  const upcard = deck.pop()!;
  state.deck = deck;
  state.lastDiscardGroup = [upcard];
  state.round += 1;
  state.status = "playing";
  state.turnPhase = "discard";
  // Loser of last round leads. Initial round: player 0.
  if (state.currentTurnIdx === null) state.currentTurnIdx = 0;
  state.lastAction = { kind: "deal", at: Date.now() };
}

// ---------- Legal-group validation ----------

/** Return true if `cards` is a legal Yaniv discard group. */
export function isLegalDiscard(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;
  // Set: all same rank
  if (cards.every((c) => c.rank === cards[0].rank)) return cards.length <= 4;
  // Run: same suit, 3+ consecutive, A=1 (low only)
  if (cards.length < 3) return false;
  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  const sorted = cards.slice().sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
  for (let i = 1; i < sorted.length; i++) {
    if (RANK_ORDER[sorted[i].rank] !== RANK_ORDER[sorted[i - 1].rank] + 1) return false;
  }
  return true;
}

// ---------- Actions ----------

export type YanivActionError =
  | { code: "NOT_YOUR_TURN" }
  | { code: "WRONG_PHASE" }
  | { code: "CARDS_NOT_IN_HAND" }
  | { code: "ILLEGAL_GROUP" }
  | { code: "EMPTY_DECK" }
  | { code: "EMPTY_DISCARD" }
  | { code: "YANIV_TOO_HIGH" }
  | { code: "NOT_PLAYING" };

function currentPlayer(s: YanivGameState): YanivPlayerSlot | null {
  if (s.currentTurnIdx === null) return null;
  return s.players[s.currentTurnIdx];
}

/** Discard a legal group. After success, turnPhase becomes "draw". */
export function discardGroup(
  state: YanivGameState,
  playerId: PlayerId,
  cardIds: string[]
): YanivActionError | null {
  if (state.status !== "playing") return { code: "NOT_PLAYING" };
  const cp = currentPlayer(state);
  if (!cp || cp.id !== playerId) return { code: "NOT_YOUR_TURN" };
  if (state.turnPhase !== "discard") return { code: "WRONG_PHASE" };
  const handMap = new Map(cp.hand.map((c) => [c.id, c]));
  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = handMap.get(id);
    if (!c) return { code: "CARDS_NOT_IN_HAND" };
    cards.push(c);
  }
  if (!isLegalDiscard(cards)) return { code: "ILLEGAL_GROUP" };
  // Apply.
  const idSet = new Set(cardIds);
  cp.hand = cp.hand.filter((c) => !idSet.has(c.id));
  state.lastDiscardGroup = cards;
  state.turnPhase = "draw";
  state.lastAction = { kind: "discard_group", by: playerId, at: Date.now() };
  return null;
}

/** Draw a card from the deck (turnPhase must be "draw"). */
export function drawFromDeck(state: YanivGameState, playerId: PlayerId): YanivActionError | null {
  if (state.status !== "playing") return { code: "NOT_PLAYING" };
  const cp = currentPlayer(state);
  if (!cp || cp.id !== playerId) return { code: "NOT_YOUR_TURN" };
  if (state.turnPhase !== "draw") return { code: "WRONG_PHASE" };
  if (state.deck.length === 0) return { code: "EMPTY_DECK" };
  cp.hand.push(state.deck.pop()!);
  passTurn(state);
  state.lastAction = { kind: "draw_deck", by: playerId, at: Date.now() };
  return null;
}

/** Draw the top card of the last discard group. */
export function drawFromDiscard(state: YanivGameState, playerId: PlayerId): YanivActionError | null {
  if (state.status !== "playing") return { code: "NOT_PLAYING" };
  const cp = currentPlayer(state);
  if (!cp || cp.id !== playerId) return { code: "NOT_YOUR_TURN" };
  if (state.turnPhase !== "draw") return { code: "WRONG_PHASE" };
  if (state.lastDiscardGroup.length === 0) return { code: "EMPTY_DISCARD" };
  // Take the "end" card so phones can choose either end if we want; for the MVP
  // we always take the last card pushed (highest rank in a run, or a same-rank pick).
  const card = state.lastDiscardGroup.pop()!;
  cp.hand.push(card);
  passTurn(state);
  state.lastAction = { kind: "draw_discard", by: playerId, card, at: Date.now() };
  return null;
}

function passTurn(state: YanivGameState) {
  state.currentTurnIdx = (state.currentTurnIdx === 0 ? 1 : 0) as 0 | 1;
  state.turnPhase = "discard";
  // If the deck runs out, just shuffle the discard group (minus its top — which is drawable) back in.
  if (state.deck.length === 0 && state.lastDiscardGroup.length > 1) {
    const top = state.lastDiscardGroup.pop()!;
    state.deck = shuffle(state.lastDiscardGroup.slice());
    state.lastDiscardGroup = [top];
  }
}

/**
 * Call "Yaniv". Must be the discard phase. Caller's hand value must be ≤ 7.
 * Returns the round-end payload (or an error).
 */
export function callYaniv(state: YanivGameState, playerId: PlayerId): YanivActionError | YanivRoundEnd {
  if (state.status !== "playing") return { code: "NOT_PLAYING" };
  const cp = currentPlayer(state);
  if (!cp || cp.id !== playerId) return { code: "NOT_YOUR_TURN" };
  if (state.turnPhase !== "discard") return { code: "WRONG_PHASE" };
  const callerVal = handValue(cp.hand);
  if (callerVal > YANIV_THRESHOLD) return { code: "YANIV_TOO_HIGH" };
  const opp = state.players.find((p) => p.id !== playerId)!;
  const oppVal = handValue(opp.hand);

  let reason: "yaniv" | "assaf";
  let winnerId: PlayerId;
  const pointsAwarded: Record<PlayerId, number> = { [cp.id]: 0, [opp.id]: 0 };

  if (oppVal <= callerVal) {
    // Assaf: opponent ties or beats caller → opponent wins; caller takes 30 + own hand value.
    reason = "assaf";
    winnerId = opp.id;
    pointsAwarded[cp.id] = ASSAF_BONUS + callerVal;
    pointsAwarded[opp.id] = 0;
    cp.score += pointsAwarded[cp.id];
  } else {
    // Successful Yaniv: caller scores 0; opponent scores their hand value.
    reason = "yaniv";
    winnerId = cp.id;
    pointsAwarded[cp.id] = 0;
    pointsAwarded[opp.id] = oppVal;
    opp.score += pointsAwarded[opp.id];
  }

  // Match-over: whoever HITS the target loses.
  const matchOver = state.players.some((p) => p.score >= state.targetScore);
  state.status = matchOver ? "match_end" : "round_end";
  state.turnPhase = null;
  state.lastAction = { kind: reason, by: playerId, at: Date.now() };

  const payload: YanivRoundEnd = {
    reason,
    caller: cp.id,
    winner: winnerId,
    hands: { [cp.id]: cp.hand.slice(), [opp.id]: opp.hand.slice() },
    handValues: { [cp.id]: callerVal, [opp.id]: oppVal },
    pointsAwarded,
    totals: { [state.players[0].id]: state.players[0].score, [state.players[1].id]: state.players[1].score },
    matchOver,
  };

  // Loser of round leads next.
  const loserId = winnerId === state.players[0].id ? state.players[1].id : state.players[0].id;
  state.currentTurnIdx = (state.players[0].id === loserId ? 0 : 1) as 0 | 1;

  state.lastRoundEnd = payload;
  for (const p of state.players) p.ready = false;
  return payload;
}

export function startNextRound(state: YanivGameState, rng?: () => number) {
  dealYanivRound(state, rng);
}
