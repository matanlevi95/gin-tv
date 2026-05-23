// Explicit re-exports so bundlers (Vite/Rollup) can statically resolve named imports
// against the CommonJS build.
export {
  // types
  HE,
} from "./types";
export type {
  Suit,
  Rank,
  Card,
  PlayerId,
  PlayerPublic,
  TurnPhase,
  PublicGameState,
  GameActionLog,
  PrivateHandState,
  MeldKind,
  Meld,
  RoundEndPayload,
  ClientToServerEvents,
  ServerToClientEvents,
  AckResult,
  HebrewKey,
} from "./types";

export {
  SUITS,
  RANKS,
  RANK_ORDER,
  cardValue,
  cardId,
  makeCard,
  buildDeck,
  shuffle,
  sortByRank,
  sortBySuit,
} from "./cards";

export {
  findAllSets,
  findAllRuns,
  allCandidateMelds,
  deadwoodValue,
  bestArrangement,
  applyLayoffs,
} from "./melds";
export type { Arrangement } from "./melds";

export {
  GIN_BONUS,
  UNDERCUT_BONUS,
  KNOCK_MAX_DEADWOOD,
  DEFAULT_TARGET_SCORE,
  scoreRound,
} from "./scoring";
export type { RoundScoreInput, RoundScoreResult } from "./scoring";

export {
  createRoomState,
  publicState,
  privateHand,
  dealRound,
  drawFromDeck,
  drawFromDiscard,
  discard,
  reorderHand,
  declareKnockOrGin,
  startNextRound,
  allReady,
} from "./game";
export type { PlayerSlot, GameRoomState, ActionError, DeclareResult } from "./game";

export { generateRoomCode, isValidRoomCode } from "./room";

export {
  PROTOCOL_VERSION,
  roomChannel,
  playerChannel,
  generatePlayerToken,
  encodeJoinUrl,
  decodeJoinUrl,
} from "./realtime";
export type {
  ActionEvent,
  PublicEvent,
  PrivateEvent,
  JoinPayload,
} from "./realtime";

export { RoomHost } from "./host";
export type { HostBroadcast } from "./host";
