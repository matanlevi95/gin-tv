import { Card, Meld, Rank, Suit } from "./types";
import { RANK_ORDER, cardValue } from "./cards";

// ---------- Generate all candidate melds from a hand ----------

export function findAllSets(cards: Card[]): Meld[] {
  const byRank = new Map<Rank, Card[]>();
  for (const c of cards) {
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank)!.push(c);
  }
  const sets: Meld[] = [];
  for (const group of byRank.values()) {
    if (group.length >= 3) {
      // 3-card combinations
      if (group.length === 3) {
        sets.push({ kind: "set", cards: group.slice() });
      } else {
        // 4 cards -> one 4-meld + four 3-melds (subsets)
        sets.push({ kind: "set", cards: group.slice() });
        for (let i = 0; i < group.length; i++) {
          const trio = group.filter((_, idx) => idx !== i);
          sets.push({ kind: "set", cards: trio });
        }
      }
    }
  }
  return sets;
}

export function findAllRuns(cards: Card[]): Meld[] {
  const bySuit = new Map<Suit, Card[]>();
  for (const c of cards) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit)!.push(c);
  }
  const runs: Meld[] = [];
  for (const group of bySuit.values()) {
    const sorted = group
      .slice()
      .sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
    // Find maximal consecutive sequences, then emit all 3+ subsequences
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (
        j < sorted.length &&
        RANK_ORDER[sorted[j].rank] === RANK_ORDER[sorted[j - 1].rank] + 1
      ) {
        j++;
      }
      const seq = sorted.slice(i, j);
      // Generate all contiguous subsequences of length >= 3
      for (let len = 3; len <= seq.length; len++) {
        for (let start = 0; start + len <= seq.length; start++) {
          runs.push({ kind: "run", cards: seq.slice(start, start + len) });
        }
      }
      i = j;
    }
  }
  return runs;
}

export function allCandidateMelds(cards: Card[]): Meld[] {
  return [...findAllSets(cards), ...findAllRuns(cards)];
}

// ---------- Best arrangement (minimum deadwood) ----------

export interface Arrangement {
  melds: Meld[];
  deadwoodCards: Card[];
  deadwood: number;
}

export function deadwoodValue(cards: Card[]): number {
  let sum = 0;
  for (const c of cards) sum += cardValue(c.rank);
  return sum;
}

/**
 * Find a non-overlapping selection of melds that minimizes the deadwood
 * (sum of card values not in any meld).
 *
 * Branch-and-bound search. Hand size is at most 11 so the search space is small.
 */
export function bestArrangement(hand: Card[]): Arrangement {
  const candidates = allCandidateMelds(hand);
  // Pre-encode each meld as a bitmask over hand indices for fast overlap checks.
  const idIndex = new Map<string, number>();
  hand.forEach((c, i) => idIndex.set(c.id, i));
  const meldMasks: { mask: bigint; meld: Meld; value: number }[] = candidates.map(
    (m) => {
      let mask = 0n;
      for (const c of m.cards) {
        const i = idIndex.get(c.id);
        if (i === undefined) throw new Error("meld card not in hand");
        mask |= 1n << BigInt(i);
      }
      return { mask, meld: m, value: deadwoodValue(m.cards) };
    }
  );
  // Sort by descending value to encourage early high-impact picks
  meldMasks.sort((a, b) => b.value - a.value);

  const totalValue = deadwoodValue(hand);
  let bestDeadwood = totalValue;
  let bestMelds: Meld[] = [];
  let bestUsedMask = 0n;

  const handMask = (1n << BigInt(hand.length)) - 1n;

  function search(idx: number, usedMask: bigint, removedValue: number) {
    const currentDeadwood = totalValue - removedValue;
    if (currentDeadwood < bestDeadwood) {
      bestDeadwood = currentDeadwood;
      bestUsedMask = usedMask;
      // Reconstruct will happen at end; instead, snapshot:
      // (we'll capture during search via a closure path)
    }
    if (currentDeadwood === 0) return;
    for (let i = idx; i < meldMasks.length; i++) {
      const cand = meldMasks[i];
      if ((cand.mask & usedMask) !== 0n) continue;
      // Optimistic bound: even if every remaining card melded, can we beat?
      // (No fast bound — small space, skip.)
      pickStack.push(cand.meld);
      search(i + 1, usedMask | cand.mask, removedValue + cand.value);
      pickStack.pop();
    }
  }

  // We need to track which melds give the best result. Recompute:
  const pickStack: Meld[] = [];
  let snapshotBestDeadwood = totalValue;
  let snapshotMelds: Meld[] = [];
  let snapshotUsedMask = 0n;

  function search2(idx: number, usedMask: bigint, removedValue: number) {
    const currentDeadwood = totalValue - removedValue;
    if (currentDeadwood < snapshotBestDeadwood) {
      snapshotBestDeadwood = currentDeadwood;
      snapshotMelds = pickStack.slice();
      snapshotUsedMask = usedMask;
    }
    if (currentDeadwood === 0) return;
    for (let i = idx; i < meldMasks.length; i++) {
      const cand = meldMasks[i];
      if ((cand.mask & usedMask) !== 0n) continue;
      pickStack.push(cand.meld);
      search2(i + 1, usedMask | cand.mask, removedValue + cand.value);
      pickStack.pop();
    }
  }

  search2(0, 0n, 0);
  bestDeadwood = snapshotBestDeadwood;
  bestMelds = snapshotMelds;
  bestUsedMask = snapshotUsedMask;

  const deadwoodCards: Card[] = [];
  hand.forEach((c, i) => {
    if ((bestUsedMask & (1n << BigInt(i))) === 0n) deadwoodCards.push(c);
  });

  return { melds: bestMelds, deadwoodCards, deadwood: bestDeadwood };
}

/**
 * Lay-off: given the opponent's deadwood cards and the knocker's melds,
 * return new deadwood after extending knocker's melds with opponent cards.
 *
 * Only applies when the round ended by knock (not gin).
 */
export function applyLayoffs(
  opponentDeadwoodCards: Card[],
  knockerMelds: Meld[]
): { remainingDeadwoodCards: Card[]; deadwoodValue: number } {
  // Try to attach each opponent card to a knocker meld.
  // A card extends a set if its rank matches the set's rank and suit not already there.
  // A card extends a run if same suit and adjacent to the run's range.
  const melds = knockerMelds.map((m) => ({ ...m, cards: m.cards.slice() }));
  const remaining: Card[] = [];
  for (const c of opponentDeadwoodCards) {
    let attached = false;
    for (const m of melds) {
      if (m.kind === "set") {
        if (
          m.cards[0].rank === c.rank &&
          !m.cards.some((x) => x.suit === c.suit) &&
          m.cards.length < 4
        ) {
          m.cards.push(c);
          attached = true;
          break;
        }
      } else {
        if (m.cards[0].suit !== c.suit) continue;
        const ranks = m.cards.map((x) => RANK_ORDER[x.rank]).sort((a, b) => a - b);
        const cr = RANK_ORDER[c.rank];
        if (cr === ranks[0] - 1 || cr === ranks[ranks.length - 1] + 1) {
          m.cards.push(c);
          attached = true;
          break;
        }
      }
    }
    if (!attached) remaining.push(c);
  }
  return {
    remainingDeadwoodCards: remaining,
    deadwoodValue: deadwoodValue(remaining),
  };
}
