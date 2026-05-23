export type Suit = "S" | "H" | "D" | "C"; // Spades, Hearts, Diamonds, Clubs
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: string; // e.g. "H7" - unique within a 52-card deck
  suit: Suit;
  rank: Rank;
}

export type PlayerId = string;

export interface PlayerPublic {
  id: PlayerId;
  name: string;
  avatar?: string;
  score: number;
  handCount: number;
  ready: boolean;
  connected: boolean;
}

export type TurnPhase = "draw" | "discard";

export interface PublicGameState {
  roomCode: string;
  status: "lobby" | "playing" | "round_end" | "match_end";
  players: PlayerPublic[];
  currentTurn: PlayerId | null;
  turnPhase: TurnPhase | null;
  deckCount: number;
  discardTop: Card | null;
  discardCount: number;
  round: number;
  targetScore: number;
  turnDeadlineMs: number | null;
  message?: string;
  lastAction?: GameActionLog;
}

export interface GameActionLog {
  kind:
    | "draw_deck"
    | "draw_discard"
    | "discard"
    | "knock"
    | "gin"
    | "undercut"
    | "round_start"
    | "deal";
  by?: PlayerId;
  card?: Card;
  at: number;
}

export interface PrivateHandState {
  hand: Card[];
  deadwood: number;
  melds: Meld[];
  canKnock: boolean;
  canGin: boolean;
}

export type MeldKind = "set" | "run";
export interface Meld {
  kind: MeldKind;
  cards: Card[];
}

export interface RoundEndPayload {
  winner: PlayerId;
  reason: "gin" | "knock" | "undercut";
  knocker?: PlayerId;
  hands: Record<PlayerId, Card[]>;
  melds: Record<PlayerId, Meld[]>;
  deadwood: Record<PlayerId, number>;
  pointsAwarded: number;
  totals: Record<PlayerId, number>;
  matchOver: boolean;
}

// ---------- Socket protocol ----------

export interface ClientToServerEvents {
  "room:create": (
    payload: { name: string; avatar?: string },
    ack: (res: AckResult<{ roomCode: string; playerId: string }>) => void
  ) => void;
  "room:join": (
    payload: { roomCode: string; name: string; avatar?: string; playerId?: string },
    ack: (res: AckResult<{ playerId: string }>) => void
  ) => void;
  "room:attach_tv": (
    payload: { roomCode: string },
    ack: (res: AckResult<{ ok: true }>) => void
  ) => void;
  "room:player_ready": (payload: { ready: boolean }) => void;
  "player:draw_deck": () => void;
  "player:draw_discard": () => void;
  "player:discard": (payload: { cardId: string }) => void;
  "player:knock": (payload: { discardCardId: string }) => void;
  "player:gin": (payload: { discardCardId: string }) => void;
  "player:reorder_hand": (payload: { order: string[] }) => void;
  "round:ready_next": () => void;
  "player:reconnect": (
    payload: { roomCode: string; playerId: string },
    ack: (res: AckResult<{ ok: true }>) => void
  ) => void;
}

export interface ServerToClientEvents {
  "room:state": (payload: PublicGameState) => void;
  "room:joined": (payload: {
    roomCode: string;
    playerId: string;
    isTV: boolean;
  }) => void;
  "game:state": (payload: PublicGameState) => void;
  "hand:state": (payload: PrivateHandState) => void;
  "round:end": (payload: RoundEndPayload) => void;
  "game:start": (payload: { round: number }) => void;
  "match:end": (payload: { winner: PlayerId; totals: Record<PlayerId, number> }) => void;
  "game:error": (payload: { code: string; message: string }) => void;
  "player:disconnect": (payload: { playerId: PlayerId }) => void;
  "player:reconnect": (payload: { playerId: PlayerId }) => void;
}

export type AckResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// ---------- Hebrew message catalog ----------
// All UI strings live here (and per-app i18n files reference them).
export const HE = {
  appTitle: "ג׳ין TV",
  joinTv: "התחבר לטלוויזיה",
  myProfile: "הפרופיל שלי",
  achievements: "הישגים",
  matchHistory: "היסטוריית משחקים",
  scanToJoin: "סרקו כדי להצטרף",
  ready: "מוכן",
  notReady: "לא מוכן",
  waitingOpponent: "ממתין ליריב",
  yourTurn: "התור שלך",
  opponentsTurn: "תור היריב",
  drawDeck: "קח מהקופה",
  drawDiscard: "קח מהזריקה",
  discard: "זרוק קלף",
  autoSort: "סידור אוטומטי",
  sortByRank: "לפי מספר",
  sortBySuit: "לפי צורה",
  knock: "נקישה",
  gin: "ג׳ין",
  clearSelection: "בטל בחירה",
  helperSelectDiscard: "בחר קלף ואז לחץ זרוק קלף",
  deadwood: "פסולת",
  round: "סבב",
  target: "ניצחון",
  winner: "המנצח",
  pointsGained: "נקודות שזכית",
  nextRound: "סיבוב נוסף",
  readyNext: "מוכן לסיבוב נוסף",
  guest: "אורח",
  totalWins: "סך ניצחונות",
  winStreak: "רצף ניצחונות",
  gamesPlayed: "משחקים ששוחקו",
  loading: "טוען…",
  errorGeneric: "אופס, משהו השתבש",
  errorRoomNotFound: "החדר לא נמצא",
  errorRoomFull: "החדר מלא",
  errorNotYourTurn: "זה לא התור שלך",
  errorMustDrawFirst: "חובה לקחת קלף לפני זריקה",
  errorAlreadyDrew: "כבר לקחת קלף השבב הזה",
  errorIllegalKnock: "אי אפשר להכריז נקישה כעת",
  errorIllegalGin: "אי אפשר להכריז ג׳ין כעת",
  errorCardNotInHand: "הקלף לא נמצא בידך",
  countdown3: "3",
  countdown2: "2",
  countdown1: "1",
  go: "צא!",
  matchOver: "המשחק נגמר",
  rematch: "משחק חוזר",
  undercut: "אנדרקאט!",
  gameTitle: "ג׳ין TV",
  connectToTV: "התחבר לטלוויזיה",
  roomCode: "קוד חדר",
  players: "שחקנים",
  you: "אתה",
  opponent: "יריב",
  timer: "זמן",
  cards: "קלפים",
  pile: "קופה",
  discardPile: "זריקה",
  startingRound: "מתחיל סבב",
  dealing: "מחלק קלפים",
  // Achievements
  ach_firstWin: "ניצחון ראשון",
  ach_firstGin: "ג׳ין ראשון",
  ach_threeStreak: "3 ניצחונות ברצף",
  ach_knockWin: "ניצחון בנקישה",
  ach_undercut: "מהפך באנדרקאט",
  ach_10games: "10 משחקים",
  ach_50games: "50 משחקים",
} as const;

export type HebrewKey = keyof typeof HE;
