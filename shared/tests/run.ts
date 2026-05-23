/**
 * Plain-TS validation script (no test framework, no paid deps).
 * Run: `npm --workspace shared run test`
 */
import {
  buildDeck,
  makeCard,
  shuffle,
  cardValue,
  findAllSets,
  findAllRuns,
  bestArrangement,
  applyLayoffs,
  scoreRound,
  GIN_BONUS,
  UNDERCUT_BONUS,
  KNOCK_MAX_DEADWOOD,
  generateRoomCode,
  isValidRoomCode,
  createRoomState,
  dealRound,
  drawFromDeck,
  drawFromDiscard,
  discard,
  declareKnockOrGin,
} from "../src";

let failed = 0;
let passed = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
    if (extra !== undefined) console.log("    ", extra);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ---------------- Deck ----------------
section("Deck");
{
  const deck = buildDeck();
  check("52 cards", deck.length === 52);
  const ids = new Set(deck.map((c) => c.id));
  check("52 unique ids", ids.size === 52);
  // 4 suits * 13 ranks
  const suits = new Set(deck.map((c) => c.suit));
  const ranks = new Set(deck.map((c) => c.rank));
  check("4 suits", suits.size === 4);
  check("13 ranks", ranks.size === 13);
}

// ---------------- Shuffle determinism ----------------
section("Shuffle");
{
  // seeded mulberry32
  function mulberry32(a: number) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  const s1 = shuffle(buildDeck(), r1).map((c) => c.id).join(",");
  const s2 = shuffle(buildDeck(), r2).map((c) => c.id).join(",");
  check("seeded shuffles match", s1 === s2);
  check("shuffle preserves all cards", new Set(s1.split(",")).size === 52);
}

// ---------------- Card values ----------------
section("Card values");
check("A=1", cardValue("A") === 1);
check("5=5", cardValue("5") === 5);
check("J=10", cardValue("J") === 10);
check("Q=10", cardValue("Q") === 10);
check("K=10", cardValue("K") === 10);

// ---------------- Set detection ----------------
section("Sets");
{
  const hand = [
    makeCard("S", "7"),
    makeCard("H", "7"),
    makeCard("D", "7"),
    makeCard("C", "2"),
  ];
  const sets = findAllSets(hand);
  check("3-of-a-kind detected", sets.some((m) => m.cards.length === 3));
  const hand4 = [
    makeCard("S", "7"),
    makeCard("H", "7"),
    makeCard("D", "7"),
    makeCard("C", "7"),
  ];
  const sets4 = findAllSets(hand4);
  check("4-of-a-kind produces one 4-meld", sets4.some((m) => m.cards.length === 4));
  check("4-of-a-kind also produces 3-card subsets", sets4.filter((m) => m.cards.length === 3).length === 4);
}

// ---------------- Run detection ----------------
section("Runs");
{
  const hand = [
    makeCard("H", "4"),
    makeCard("H", "5"),
    makeCard("H", "6"),
    makeCard("H", "7"),
    makeCard("C", "9"),
  ];
  const runs = findAllRuns(hand);
  // 4-5-6, 5-6-7, 4-5-6-7
  check("3-run 4-5-6", runs.some((m) => m.cards.length === 3 && m.cards[0].rank === "4"));
  check("3-run 5-6-7", runs.some((m) => m.cards.length === 3 && m.cards[0].rank === "5"));
  check("4-run 4-5-6-7", runs.some((m) => m.cards.length === 4));

  // No wrap-around (K-A-2 not a run)
  const wrap = findAllRuns([
    makeCard("S", "K"),
    makeCard("S", "A"),
    makeCard("S", "2"),
  ]);
  check("no K-A-2 wrap", wrap.length === 0);
}

// ---------------- Deadwood ----------------
section("Deadwood");
{
  // 10-card laid hand with 2 perfect melds + deadwood
  const hand = [
    // run hearts 4-5-6-7
    makeCard("H", "4"),
    makeCard("H", "5"),
    makeCard("H", "6"),
    makeCard("H", "7"),
    // set 9s
    makeCard("S", "9"),
    makeCard("H", "9"),
    makeCard("D", "9"),
    // deadwood
    makeCard("C", "K"),
    makeCard("S", "2"),
    makeCard("D", "5"),
  ];
  const arr = bestArrangement(hand);
  // deadwood: K(10) + 2 + 5 = 17
  check("deadwood arithmetic", arr.deadwood === 17, arr);
  check("two melds chosen", arr.melds.length === 2);

  // Gin hand (10 cards, deadwood 0)
  const gin = [
    makeCard("S", "3"),
    makeCard("S", "4"),
    makeCard("S", "5"),
    makeCard("H", "8"),
    makeCard("D", "8"),
    makeCard("C", "8"),
    makeCard("H", "J"),
    makeCard("D", "J"),
    makeCard("C", "J"),
    makeCard("S", "J"),
  ];
  const arrGin = bestArrangement(gin);
  check("gin deadwood = 0", arrGin.deadwood === 0, arrGin);
}

// ---------------- Layoff ----------------
section("Layoffs");
{
  const knockerMelds = [
    {
      kind: "run" as const,
      cards: [makeCard("H", "4"), makeCard("H", "5"), makeCard("H", "6")],
    },
    {
      kind: "set" as const,
      cards: [makeCard("S", "9"), makeCard("H", "9"), makeCard("D", "9")],
    },
  ];
  const opponentDead = [makeCard("H", "7"), makeCard("C", "9"), makeCard("S", "K")];
  const res = applyLayoffs(opponentDead, knockerMelds);
  // H7 extends run, C9 extends set, K stays
  check("layoff reduces deadwood", res.remainingDeadwoodCards.length === 1, res);
  check("only K(10) remains", res.deadwoodValue === 10, res);
}

// ---------------- Scoring ----------------
section("Scoring");
{
  // Knock scoring
  const knockerHand = [
    makeCard("H", "4"),
    makeCard("H", "5"),
    makeCard("H", "6"),
    makeCard("S", "9"),
    makeCard("H", "9"),
    makeCard("D", "9"),
    makeCard("C", "2"),
    makeCard("C", "3"),
    makeCard("D", "4"),
    makeCard("S", "A"), // deadwood 2+3+4+1 = 10? actually we have melds and dead
  ];
  // Best: H4-5-6 (run), 9s set, deadwood = C2(2)+C3(3)+D4(4)+SA(1) = 10
  const opponentHand = [
    makeCard("S", "K"),
    makeCard("H", "K"),
    makeCard("D", "Q"),
    makeCard("C", "J"),
    makeCard("S", "10"),
    makeCard("D", "8"),
    makeCard("C", "7"),
    makeCard("H", "6"),
    makeCard("S", "5"),
    makeCard("D", "3"),
  ];
  const r = scoreRound({ knockerHand, opponentHand, declaration: "knock" });
  check("knocker wins when not undercut", r.winner === "knocker", r);
  check("knock points = opp_dead_after - knocker_dead", r.points === r.opponentDeadwoodAfter - r.knockerDeadwood, r);

  // Gin scoring
  const ginHand = [
    makeCard("S", "3"),
    makeCard("S", "4"),
    makeCard("S", "5"),
    makeCard("H", "8"),
    makeCard("D", "8"),
    makeCard("C", "8"),
    makeCard("H", "J"),
    makeCard("D", "J"),
    makeCard("C", "J"),
    makeCard("S", "J"),
  ];
  const g = scoreRound({ knockerHand: ginHand, opponentHand, declaration: "gin" });
  check("gin awards GIN_BONUS + opp deadwood", g.points === g.opponentDeadwoodBefore + GIN_BONUS, g);

  // Undercut: opponent deadwood after layoff <= knocker deadwood
  const knockHigh = [
    // bad knock - allowed to attempt? KNOCK_MAX_DEADWOOD = 10
    // Make knocker deadwood exactly 10
    makeCard("H", "4"),
    makeCard("H", "5"),
    makeCard("H", "6"),
    makeCard("S", "9"),
    makeCard("H", "9"),
    makeCard("D", "9"),
    makeCard("C", "2"),
    makeCard("C", "3"),
    makeCard("D", "4"),
    makeCard("S", "A"),
  ];
  const opLow = [
    // opponent with low deadwood
    makeCard("S", "2"),
    makeCard("H", "2"),
    makeCard("D", "2"),
    makeCard("C", "5"),
    makeCard("C", "6"),
    makeCard("C", "7"),
    makeCard("H", "A"),
    makeCard("D", "A"),
    makeCard("C", "A"),
    makeCard("S", "3"),
  ];
  const u = scoreRound({ knockerHand: knockHigh, opponentHand: opLow, declaration: "knock" });
  check("undercut detected", u.reason === "undercut", u);
  check("opponent wins on undercut", u.winner === "opponent");
  check("undercut points include bonus", u.points >= UNDERCUT_BONUS);

  // KNOCK_MAX_DEADWOOD constant
  check("knock max = 10", KNOCK_MAX_DEADWOOD === 10);
}

// ---------------- Room codes ----------------
section("Room codes");
{
  const code = generateRoomCode(() => 0.1234);
  check("4-char room code", code.length === 4);
  check("room code valid", isValidRoomCode(code));
  check("0 not in alphabet", !isValidRoomCode("0AAA"));
  check("I not in alphabet", !isValidRoomCode("IAAA"));
}

// ---------------- Full game flow ----------------
section("Game flow");
{
  const state = createRoomState("TEST");
  state.players.push({
    id: "p1",
    name: "Daniel",
    score: 0,
    ready: true,
    connected: true,
    hand: [],
  });
  state.players.push({
    id: "p2",
    name: "Yoni",
    score: 0,
    ready: true,
    connected: true,
    hand: [],
  });
  dealRound(state, () => 0.5);
  check("each player has 10 cards", state.players.every((p) => p.hand.length === 10));
  check("discard has 1 card", state.discard.length === 1);
  check("deck has 31 cards", state.deck.length === 31);

  const p1 = state.players[0].id;
  const p2 = state.players[1].id;

  // wrong-turn error
  const wrongTurnErr = drawFromDeck(state, p2);
  check("not your turn rejected", wrongTurnErr?.code === "NOT_YOUR_TURN");

  // p1 draws then discards
  const drawErr = drawFromDeck(state, p1);
  check("draw deck ok", drawErr === null);
  check("p1 now has 11 cards", state.players[0].hand.length === 11);

  const cantDrawAgain = drawFromDeck(state, p1);
  check("cannot draw twice", cantDrawAgain?.code === "WRONG_PHASE");

  const lastCard = state.players[0].hand[state.players[0].hand.length - 1];
  const discardErr = discard(state, p1, lastCard.id);
  check("discard ok", discardErr === null);
  check("turn passed to p2", state.currentTurnIdx === 1);
  check("p1 back to 10 cards", state.players[0].hand.length === 10);

  // p2 takes from discard
  const drawDisc = drawFromDiscard(state, p2);
  check("draw discard ok", drawDisc === null);
  check("p2 has 11 cards", state.players[1].hand.length === 11);
  check("discard pile loses top after draw", state.discard.length === 1);
}

// ---------------- Gin declaration ----------------
section("Gin declaration");
{
  const state = createRoomState("TEST");
  state.players.push({ id: "p1", name: "A", score: 0, ready: true, connected: true, hand: [] });
  state.players.push({ id: "p2", name: "B", score: 0, ready: true, connected: true, hand: [] });
  // Set up a gin-able 11-card hand for p1 by direct manipulation
  state.status = "playing";
  state.currentTurnIdx = 0;
  state.turnPhase = "discard";
  state.players[0].hand = [
    makeCard("S", "3"),
    makeCard("S", "4"),
    makeCard("S", "5"),
    makeCard("H", "8"),
    makeCard("D", "8"),
    makeCard("C", "8"),
    makeCard("H", "J"),
    makeCard("D", "J"),
    makeCard("C", "J"),
    makeCard("S", "J"),
    makeCard("D", "2"), // discard this one
  ];
  state.players[1].hand = [
    makeCard("S", "K"),
    makeCard("H", "K"),
    makeCard("D", "Q"),
    makeCard("C", "Q"),
    makeCard("S", "10"),
    makeCard("D", "9"),
    makeCard("C", "7"),
    makeCard("H", "6"),
    makeCard("S", "2"),
    makeCard("D", "5"),
  ];

  const res = declareKnockOrGin(state, "p1", "D2", "gin");
  if ("code" in res) {
    check("gin accepted", false, res);
  } else {
    check("gin accepted", res.payload.reason === "gin");
    check("gin awards bonus", res.payload.pointsAwarded >= 25);
    const endStatus: string = state.status;
    check("status round_end or match_end", endStatus === "round_end" || endStatus === "match_end");
  }
}

// ---------------- Summary ----------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
