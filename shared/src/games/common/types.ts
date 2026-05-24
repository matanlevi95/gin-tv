/**
 * Game-agnostic types: GameType enum, base public state pieces shared by every
 * game, and the GameAdapter interface that the generic RoomHost calls into.
 */
import type { Card, PlayerId, PlayerPublic, RoundEndPayload } from "../../types";

export type GameType = "gin" | "yaniv";

/**
 * Slim per-player data the generic RoomHost owns. Each game's adapter holds
 * its own additional per-player state (hand, melds, etc.) keyed by playerId.
 */
export interface BasePlayer {
  id: PlayerId;
  name: string;
  avatar?: string;
  score: number;
  ready: boolean;
  connected: boolean;
}

/** Common shape any game's public state must satisfy. Game-specific extras live alongside. */
export interface BasePublicState {
  roomCode: string;
  gameType: GameType;
  status: "lobby" | "playing" | "round_end" | "match_end";
  players: PlayerPublic[];
  currentTurn: PlayerId | null;
  round: number;
  targetScore: number;
  lastAction?: { kind: string; by?: PlayerId; card?: Card; at: number };
}

/**
 * The interface each game must provide. The RoomHost owns lobby/ready/reconnect
 * and delegates everything else here.
 */
export interface GameAdapter<GameState, PublicState extends BasePublicState, PrivateState, ActionPayload> {
  type: GameType;
  /** Build initial state given an array of 2 players. */
  createState(players: BasePlayer[], roomCode: string): GameState;
  /** Deal a new round in-place. */
  dealNewRound(state: GameState): void;
  /** Project to publicState for broadcast. */
  getPublic(state: GameState): PublicState;
  /** Project to a single player's private state. */
  getPrivate(state: GameState, playerId: PlayerId): PrivateState;
  /**
   * Handle a player intent. Returns either an error code or — when a round ends
   * via this action — a RoundEndPayload that the host will broadcast.
   */
  handleAction(
    state: GameState,
    playerId: PlayerId,
    action: ActionPayload
  ): { error: { code: string; message: string } } | { ok: true; roundEnd?: RoundEndPayload };
  /** Score-based match-over check (called by host after each action). */
  isMatchOver(state: GameState): boolean;
}
