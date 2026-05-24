/**
 * Yaniv engine validation. Mirrors the Gin test style (no framework, no deps).
 *   `npm --workspace shared run test:yaniv`
 */
import { makeCard } from "../src/cards";
import {
  callYaniv,
  createYanivState,
  dealYanivRound,
  discardGroup,
  drawFromDeck,
  drawFromDiscard,
  handValue,
  isLegalDiscard,
  YANIV_DEFAULT_TARGET,
  YANIV_THRESHOLD,
} from "../src/games/yaniv/engine";

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.log("  ✗", name); if (extra !== undefined) console.log("    ", extra); }
};
const section = (s: string) => console.log("\n" + s);

// ---------- hand value ----------
section("Hand value");
check("A=1, 5=5, K=10", handValue([makeCard("S", "A"), makeCard("H", "5"), makeCard("D", "K")]) === 16);
check("empty hand = 0", handValue([]) === 0);

// ---------- legal discards ----------
section("Legal discards");
check("single OK", isLegalDiscard([makeCard("S", "7")]));
check("set of 2 OK (pair)", isLegalDiscard([makeCard("S", "5"), makeCard("H", "5")]));
check("set of 4 OK", isLegalDiscard([makeCard("S","5"), makeCard("H","5"), makeCard("D","5"), makeCard("C","5")]));
check("run of 3 same suit OK", isLegalDiscard([makeCard("S","4"), makeCard("S","5"), makeCard("S","6")]));
check("run of 5 OK", isLegalDiscard([makeCard("H","9"), makeCard("H","10"), makeCard("H","J"), makeCard("H","Q"), makeCard("H","K")]));
check("run of 2 NOT OK", !isLegalDiscard([makeCard("S","4"), makeCard("S","5")]));
check("mixed suits run NOT OK", !isLegalDiscard([makeCard("S","4"), makeCard("H","5"), makeCard("S","6")]));
check("non-consecutive NOT OK", !isLegalDiscard([makeCard("S","4"), makeCard("S","6"), makeCard("S","7")]));
check("set of mixed ranks NOT OK", !isLegalDiscard([makeCard("S","5"), makeCard("H","6")]));
check("K-A-2 NOT a run", !isLegalDiscard([makeCard("S","K"), makeCard("S","A"), makeCard("S","2")]));

// ---------- deal ----------
section("Deal");
{
  const s = createYanivState("YANV");
  s.players.push({ id: "p1", name: "A", score: 0, ready: true, connected: true, hand: [] });
  s.players.push({ id: "p2", name: "B", score: 0, ready: true, connected: true, hand: [] });
  dealYanivRound(s, () => 0.4);
  check("each has 5 cards", s.players.every((p) => p.hand.length === 5));
  check("discard group has 1 card (upcard)", s.lastDiscardGroup.length === 1);
  check("deck has 52 - 10 - 1 = 41", s.deck.length === 41);
  check("first turn p1", s.currentTurnIdx === 0);
  check("turn phase is discard", s.turnPhase === "discard");
}

// ---------- turn flow ----------
section("Turn flow");
{
  const s = createYanivState("YANV");
  s.players.push({ id: "p1", name: "A", score: 0, ready: true, connected: true, hand: [] });
  s.players.push({ id: "p2", name: "B", score: 0, ready: true, connected: true, hand: [] });
  dealYanivRound(s, () => 0.2);

  // p2 cannot act before turn passes
  const wrong = discardGroup(s, "p2", [s.players[1].hand[0].id]);
  check("non-turn discard rejected", wrong?.code === "NOT_YOUR_TURN");

  // p1 discards a single card
  const single = s.players[0].hand[0];
  const err = discardGroup(s, "p1", [single.id]);
  check("single discard ok", err === null);
  check("turn phase is draw", s.turnPhase === "draw");
  check("p1 has 4 cards now", s.players[0].hand.length === 4);
  check("last discard group is that single card", s.lastDiscardGroup.length === 1 && s.lastDiscardGroup[0].id === single.id);

  // p1 draws from deck
  const drawErr = drawFromDeck(s, "p1");
  check("draw from deck ok", drawErr === null);
  check("p1 back to 5 cards", s.players[0].hand.length === 5);
  check("turn passed to p2", s.currentTurnIdx === 1);
  check("turn phase reset to discard", s.turnPhase === "discard");
}

// ---------- yaniv call (successful) ----------
section("Yaniv call (successful)");
{
  const s = createYanivState("YANV");
  s.players.push({ id: "p1", name: "A", score: 0, ready: true, connected: true, hand: [] });
  s.players.push({ id: "p2", name: "B", score: 0, ready: true, connected: true, hand: [] });
  s.status = "playing"; s.turnPhase = "discard"; s.currentTurnIdx = 0; s.round = 1;
  // p1 hand value = 1+1+2+2 = 6 (≤7 ok)
  s.players[0].hand = [makeCard("S","A"), makeCard("H","A"), makeCard("D","2"), makeCard("C","2")];
  // p2 has a high hand
  s.players[1].hand = [makeCard("S","K"), makeCard("H","Q"), makeCard("D","J"), makeCard("C","10"), makeCard("S","9")];

  const res = callYaniv(s, "p1");
  if ("code" in res) check("yaniv accepted", false, res);
  else {
    check("yaniv accepted", true);
    check("reason=yaniv", res.reason === "yaniv");
    check("winner is p1", res.winner === "p1");
    check("p1 score stays 0", res.totals["p1"] === 0);
    check("p2 receives full hand value", res.totals["p2"] === 49);
  }
}

// ---------- assaf (caller is undercut) ----------
section("Assaf");
{
  const s = createYanivState("YANV");
  s.players.push({ id: "p1", name: "A", score: 0, ready: true, connected: true, hand: [] });
  s.players.push({ id: "p2", name: "B", score: 0, ready: true, connected: true, hand: [] });
  s.status = "playing"; s.turnPhase = "discard"; s.currentTurnIdx = 0; s.round = 1;
  // p1 hand value = 6
  s.players[0].hand = [makeCard("S","A"), makeCard("H","A"), makeCard("D","2"), makeCard("C","2")];
  // p2 hand value = 4 (lower than caller → ASSAF)
  s.players[1].hand = [makeCard("S","A"), makeCard("H","3")];

  const res = callYaniv(s, "p1");
  if ("code" in res) check("yaniv attempt accepted (assaf result)", false, res);
  else {
    check("reason=assaf", res.reason === "assaf");
    check("winner is p2 (opponent)", res.winner === "p2");
    check("p1 takes 30 + 6 = 36", res.totals["p1"] === 36);
    check("p2 score stays 0", res.totals["p2"] === 0);
  }
}

// ---------- yaniv too high (illegal) ----------
section("Yaniv illegal when hand > 7");
{
  const s = createYanivState("YANV");
  s.players.push({ id: "p1", name: "A", score: 0, ready: true, connected: true, hand: [] });
  s.players.push({ id: "p2", name: "B", score: 0, ready: true, connected: true, hand: [] });
  s.status = "playing"; s.turnPhase = "discard"; s.currentTurnIdx = 0; s.round = 1;
  s.players[0].hand = [makeCard("S","10"), makeCard("H","2")]; // value 12
  s.players[1].hand = [makeCard("D","5")];
  const res = callYaniv(s, "p1");
  check("rejected when over threshold", "code" in res && res.code === "YANIV_TOO_HIGH");
}

// ---------- match-end ----------
section("Match end at target");
{
  const s = createYanivState("YANV");
  s.players.push({ id: "p1", name: "A", score: 95, ready: true, connected: true, hand: [] });
  s.players.push({ id: "p2", name: "B", score: 30, ready: true, connected: true, hand: [] });
  s.status = "playing"; s.turnPhase = "discard"; s.currentTurnIdx = 0; s.round = 5;
  s.players[0].hand = [makeCard("S","A"), makeCard("H","A")]; // value 2
  s.players[1].hand = [makeCard("S","A")]; // value 1 → assaf
  const res = callYaniv(s, "p1");
  if ("code" in res) check("call accepted", false, res);
  else {
    // p1 takes 30 + 2 = 32 → 95 + 32 = 127 → match over
    check("match over (95 + 32 ≥ 100)", res.matchOver === true);
    check("p1 final = 127", res.totals["p1"] === 127);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
