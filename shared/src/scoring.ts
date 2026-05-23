import { Card } from "./types";
import { applyLayoffs, bestArrangement } from "./melds";

export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;
/** Awarded to the match winner once one player reaches the target score. */
export const GAME_BONUS = 100;
/** Additional bonus when the opponent finished the match with 0 points. */
export const SHUTOUT_BONUS = 100;
export const KNOCK_MAX_DEADWOOD = 10;
export const DEFAULT_TARGET_SCORE = 100;

export interface RoundScoreInput {
  knockerHand: Card[];
  opponentHand: Card[];
  declaration: "gin" | "knock";
}

export interface RoundScoreResult {
  winner: "knocker" | "opponent";
  reason: "gin" | "knock" | "undercut";
  knockerDeadwood: number;
  opponentDeadwoodBefore: number;
  opponentDeadwoodAfter: number; // after lay-offs (for knock)
  points: number;
  knockerArrangement: ReturnType<typeof bestArrangement>;
  opponentArrangement: ReturnType<typeof bestArrangement>;
}

export function scoreRound(input: RoundScoreInput): RoundScoreResult {
  const knockerArr = bestArrangement(input.knockerHand);
  const opponentArr = bestArrangement(input.opponentHand);

  if (input.declaration === "gin") {
    // No lay-offs on gin.
    return {
      winner: "knocker",
      reason: "gin",
      knockerDeadwood: 0,
      opponentDeadwoodBefore: opponentArr.deadwood,
      opponentDeadwoodAfter: opponentArr.deadwood,
      points: opponentArr.deadwood + GIN_BONUS,
      knockerArrangement: knockerArr,
      opponentArrangement: opponentArr,
    };
  }

  // Knock: opponent may lay off onto knocker melds.
  const layoff = applyLayoffs(opponentArr.deadwoodCards, knockerArr.melds);
  const opDeadAfter = layoff.deadwoodValue;
  if (opDeadAfter <= knockerArr.deadwood) {
    // Undercut!
    return {
      winner: "opponent",
      reason: "undercut",
      knockerDeadwood: knockerArr.deadwood,
      opponentDeadwoodBefore: opponentArr.deadwood,
      opponentDeadwoodAfter: opDeadAfter,
      points: knockerArr.deadwood - opDeadAfter + UNDERCUT_BONUS,
      knockerArrangement: knockerArr,
      opponentArrangement: opponentArr,
    };
  }
  return {
    winner: "knocker",
    reason: "knock",
    knockerDeadwood: knockerArr.deadwood,
    opponentDeadwoodBefore: opponentArr.deadwood,
    opponentDeadwoodAfter: opDeadAfter,
    points: opDeadAfter - knockerArr.deadwood,
    knockerArrangement: knockerArr,
    opponentArrangement: opponentArr,
  };
}
