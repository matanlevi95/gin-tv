/**
 * Gin Hand Controller — phone-as-hand.
 *
 * Layout: cards arranged in a 2D grid (2 rows by default). Easy to read,
 * full-size taps, no horizontal scroll. Cards can be dragged freely between
 * any two slots — pick one up, drop on another, they swap positions.
 *
 * Pan starts after a small movement (no long-press), so reordering is
 * immediately discoverable: tap = select, drag = move.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  HE,
  Card,
  RANK_ORDER,
  bestArrangement,
  cardValue,
  sortByRank,
  sortBySuit,
} from "@gin-tv/shared";
import { theme } from "../../../theme";
import { useGame } from "../../../state/GameContext";
import { CardView } from "../../../components/CardView";
import { RootStackParamList } from "../../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Hand">;

const SCREEN_W = Dimensions.get("window").width;
const CARDS_PER_ROW = 6; // 6 in row 1, remainder in row 2 (so 5/5, 5/6, or 6/5)
const SIDE_PAD = 12;
const COL_GAP = 4;
const ROW_GAP = 14;
const CARD_W = Math.floor(
  (SCREEN_W - SIDE_PAD * 2 - COL_GAP * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW
);
const CARD_H = Math.round(CARD_W * 1.45);

const MELD_COLORS = ["#4caf6d", "#d4a85b", "#c8553d", "#6a8caf", "#b478c9"];

function visualMelds(hand: Card[]): {
  ranges: [number, number, number][];
  deadwood: number;
} {
  const ranges: [number, number, number][] = [];
  let i = 0;
  let colorIdx = 0;
  while (i < hand.length) {
    let bestLen = 0;
    for (let len = Math.min(hand.length - i, 4); len >= 3; len--) {
      const slice = hand.slice(i, i + len);
      if (isVisualMeld(slice)) {
        bestLen = len;
        break;
      }
    }
    if (bestLen > 0) {
      ranges.push([i, i + bestLen, colorIdx]);
      colorIdx = (colorIdx + 1) % MELD_COLORS.length;
      i += bestLen;
    } else {
      i += 1;
    }
  }
  const meldIdx = new Set<number>();
  for (const [s, e] of ranges) for (let j = s; j < e; j++) meldIdx.add(j);
  let dw = 0;
  for (let j = 0; j < hand.length; j++) {
    if (!meldIdx.has(j)) dw += cardValue(hand[j].rank);
  }
  return { ranges, deadwood: dw };
}

function isVisualMeld(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  if (cards.every((c) => c.rank === cards[0].rank)) return true;
  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  const sorted = cards.slice().sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
  for (let i = 1; i < sorted.length; i++) {
    if (RANK_ORDER[sorted[i].rank] !== RANK_ORDER[sorted[i - 1].rank] + 1) return false;
  }
  return true;
}

function indexToGrid(i: number) {
  const row = Math.floor(i / CARDS_PER_ROW);
  const col = i % CARDS_PER_ROW;
  return { row, col };
}
function gridToXY(row: number, col: number) {
  return {
    x: SIDE_PAD + col * (CARD_W + COL_GAP),
    y: row * (CARD_H + ROW_GAP),
  };
}

export function HandScreen({ navigation }: Props) {
  const {
    publicState,
    privateState,
    playerId,
    drawDeck,
    drawDiscard,
    discardCard,
    knock,
    gin,
    reorderHand,
    errorMessage,
    lastRoundEnd,
  } = useGame();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  useEffect(() => {
    if (lastRoundEnd) navigation.replace("RoundResult");
  }, [lastRoundEnd, navigation]);

  const me = publicState?.players.find((p) => p.id === playerId);
  const isMyTurn = publicState?.currentTurn === playerId;
  const phase = publicState?.turnPhase;

  useEffect(() => {
    const serverIds = privateState?.hand.map((c) => c.id) ?? [];
    if (serverIds.length === 0) {
      setLocalOrder(null);
      return;
    }
    if (!localOrder) {
      setLocalOrder(serverIds);
      return;
    }
    const serverSet = new Set(serverIds);
    const filtered = localOrder.filter((id) => serverSet.has(id));
    const localSet = new Set(filtered);
    const appended = serverIds.filter((id) => !localSet.has(id));
    const next = [...filtered, ...appended];
    if (next.length !== localOrder.length || next.some((id, i) => id !== localOrder[i])) {
      setLocalOrder(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privateState?.hand]);

  const hand = useMemo<Card[]>(() => {
    if (!privateState) return [];
    const map = new Map(privateState.hand.map((c) => [c.id, c]));
    const order = localOrder ?? privateState.hand.map((c) => c.id);
    const out: Card[] = [];
    for (const id of order) {
      const c = map.get(id);
      if (c) out.push(c);
    }
    return out;
  }, [privateState, localOrder]);

  const { ranges: meldRanges, deadwood: visualDeadwoodVal } = useMemo(
    () => visualMelds(hand),
    [hand]
  );
  const meldColorByCard = useMemo(() => {
    const m = new Map<string, string>();
    for (const [s, e, c] of meldRanges) {
      for (let i = s; i < e; i++) m.set(hand[i].id, MELD_COLORS[c]);
    }
    return m;
  }, [meldRanges, hand]);

  const optimalDeadwood = privateState?.deadwood ?? 0;

  const pushReorder = useCallback(
    (order: string[]) => {
      setLocalOrder(order);
      reorderHand(order);
    },
    [reorderHand]
  );

  const onSelect = useCallback((cardId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedId((prev) => (prev === cardId ? null : cardId));
  }, []);

  const onSort = useCallback(
    (mode: "rank" | "suit" | "auto") => {
      Haptics.selectionAsync().catch(() => {});
      let sorted: Card[];
      if (mode === "rank") sorted = sortByRank(hand);
      else if (mode === "suit") sorted = sortBySuit(hand);
      else sorted = autoSortByMelds(hand);
      pushReorder(sorted.map((c) => c.id));
    },
    [hand, pushReorder]
  );

  const onDiscard = useCallback(() => {
    if (!selectedId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    discardCard(selectedId);
    setSelectedId(null);
  }, [selectedId, discardCard]);

  const onKnock = useCallback(() => {
    if (!selectedId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    knock(selectedId);
    setSelectedId(null);
  }, [selectedId, knock]);

  const onGin = useCallback(() => {
    if (!selectedId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    gin(selectedId);
    setSelectedId(null);
  }, [selectedId, gin]);

  const showKnockInfo = () => {
    Alert.alert(
      "מה זה נקישה?",
      "נקישה = סוגרים את הסיבוב כשערך הפסולת ביד שלך ≤ 10. אתה זורק קלף סופי כדי להכריז.\n\n• אם ערך הפסולת שלך נמוך מהיריב → אתה זוכה בהפרש.\n• אם ליריב פסולת שווה או נמוכה משלך → אנדרקאט! היריב מקבל את ההפרש + 25 נקודות בונוס.\n\nג׳ין (כפתור הזהוב) = אין לך פסולת בכלל (כל הקלפים בסדרות). בונוס 25 נקודות + כל הפסולת של היריב."
    );
  };

  if (!publicState || !privateState || !me) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.loadingText}>{HE.loading}</Text>
      </SafeAreaView>
    );
  }

  const canDiscard = isMyTurn && phase === "discard" && !!selectedId;
  const canKnock =
    isMyTurn &&
    phase === "discard" &&
    !!selectedId &&
    privateState.hand.length === 11 &&
    canKnockNow(privateState.hand, selectedId);
  const canGin =
    isMyTurn &&
    phase === "discard" &&
    !!selectedId &&
    privateState.hand.length === 11 &&
    canGinNow(privateState.hand, selectedId);

  // Compute grid dimensions for the hand area
  const rows = Math.ceil(hand.length / CARDS_PER_ROW);
  const gridHeight = rows * CARD_H + (rows - 1) * ROW_GAP;
  const gridWidth = SCREEN_W;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.headerRow}>
          <TurnPill mine={isMyTurn} phase={phase ?? null} />
          <Text style={styles.metaText}>
            יד: {privateState.hand.length} · פסולת: {visualDeadwoodVal}
            {visualDeadwoodVal !== optimalDeadwood && (
              <Text style={{ color: theme.textDim }}>  ({optimalDeadwood})</Text>
            )}
          </Text>
        </View>

        <View style={styles.drawRow}>
          <DrawBtn
            label={HE.drawDeck}
            sub={`קופה (${publicState.deckCount})`}
            enabled={isMyTurn && phase === "draw"}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              drawDeck();
            }}
          />
          <DrawBtn
            label={HE.drawDiscard}
            sub="זריקה — ראה ב-TV"
            enabled={isMyTurn && phase === "draw" && !!publicState.discardTop}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              drawDiscard();
            }}
          />
        </View>

        <View style={[styles.handArea, { height: gridHeight + 20 }]}>
          <GridHand
            hand={hand}
            cardW={CARD_W}
            cardH={CARD_H}
            gridWidth={gridWidth}
            selectedId={selectedId}
            meldColorByCard={meldColorByCard}
            onTap={onSelect}
            onReorder={pushReorder}
          />
        </View>

        <View style={styles.sortRow}>
          <SortPill label={HE.autoSort} onPress={() => onSort("auto")} />
          <SortPill label={HE.sortByRank} onPress={() => onSort("rank")} />
          <SortPill label={HE.sortBySuit} onPress={() => onSort("suit")} />
          {selectedId && (
            <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>{HE.clearSelection}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionRow}>
          <View style={{ flex: 1, position: "relative" }}>
            <ActionBtn label={HE.knock} onPress={onKnock} enabled={canKnock} variant="secondary" />
            <InfoButton onPress={showKnockInfo} />
          </View>
          <ActionBtn label={HE.discard} onPress={onDiscard} enabled={canDiscard} variant="primary" />
          <ActionBtn label={HE.gin} onPress={onGin} enabled={canGin} variant="gold" />
        </View>

        {errorMessage && (
          <View style={styles.errorToast}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

/* ---------------- GridHand: 2D draggable grid ---------------- */

function GridHand({
  hand,
  cardW,
  cardH,
  gridWidth,
  selectedId,
  meldColorByCard,
  onTap,
  onReorder,
}: {
  hand: Card[];
  cardW: number;
  cardH: number;
  gridWidth: number;
  selectedId: string | null;
  meldColorByCard: Map<string, string>;
  onTap: (id: string) => void;
  onReorder: (order: string[]) => void;
}) {
  const slotW = cardW + COL_GAP;
  const slotH = cardH + ROW_GAP;
  return (
    <View style={{ width: gridWidth, height: "100%" }}>
      {hand.map((c, i) => (
        <CardSlot
          key={c.id}
          card={c}
          index={i}
          handLength={hand.length}
          slotW={slotW}
          slotH={slotH}
          selected={selectedId === c.id}
          meldColor={meldColorByCard.get(c.id)}
          onTap={() => onTap(c.id)}
          onDragEnd={(newIndex) => {
            if (newIndex === i) return;
            const ids = hand.map((x) => x.id);
            const moved = ids.splice(i, 1)[0];
            ids.splice(newIndex, 0, moved);
            onReorder(ids);
          }}
        />
      ))}
    </View>
  );
}

function CardSlot({
  card,
  index,
  handLength,
  slotW,
  slotH,
  selected,
  meldColor,
  onTap,
  onDragEnd,
}: {
  card: Card;
  index: number;
  handLength: number;
  slotW: number;
  slotH: number;
  selected: boolean;
  meldColor: string | undefined;
  onTap: () => void;
  onDragEnd: (newIndex: number) => void;
}) {
  const { row, col } = indexToGrid(index);
  const { x: baseX, y: baseY } = gridToXY(row, col);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const z = useSharedValue(index);

  useEffect(() => {
    tx.value = withSpring(0, { damping: 18, stiffness: 220 });
    ty.value = withSpring(0, { damping: 18, stiffness: 220 });
    z.value = index;
  }, [index, tx, ty, z]);

  // Pan: starts after ~12px movement so a small finger jitter on tap won't trigger it.
  const pan = Gesture.Pan()
    .minDistance(12)
    .onStart(() => {
      z.value = 999;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd(() => {
      // Compute drop position in grid coordinates.
      const dropX = baseX + tx.value;
      const dropY = baseY + ty.value;
      const newCol = Math.round((dropX - SIDE_PAD) / (slotW));
      const newRow = Math.round(dropY / slotH);
      let target = newRow * CARDS_PER_ROW + newCol;
      if (target < 0) target = 0;
      if (target > handLength - 1) target = handLength - 1;
      tx.value = withSpring(0, { damping: 18, stiffness: 220 });
      ty.value = withSpring(0, { damping: 18, stiffness: 220 });
      runOnJS(onDragEnd)(target);
    });

  const tap = Gesture.Tap().maxDuration(220).onEnd((_e, success) => {
    if (success) runOnJS(onTap)();
  });
  const composed = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: z.value,
    elevation: z.value > 100 ? 20 : 0,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: baseX,
            top: baseY,
            width: CARD_W,
            height: CARD_H,
          },
          animatedStyle,
        ]}
      >
        <CardView
          card={card}
          size="md"
          selected={selected}
          meldColor={meldColor}
          style={{ width: CARD_W, height: CARD_H }}
        />
      </Animated.View>
    </GestureDetector>
  );
}

function TurnPill({ mine, phase }: { mine: boolean; phase: "draw" | "discard" | null }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (mine) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [mine, pulse]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 + 0.4 * pulse.value,
  }));
  return (
    <Animated.View
      style={[
        styles.pill,
        {
          backgroundColor: mine ? "rgba(212,168,91,0.18)" : "transparent",
          borderColor: mine ? theme.gold : "rgba(212,168,91,0.2)",
        },
        style,
      ]}
    >
      <Text style={[styles.pillText, { color: mine ? theme.gold : theme.textDim }]}>
        {mine ? `${HE.yourTurn} · ${phase === "draw" ? "קח" : "זרוק"}` : HE.opponentsTurn}
      </Text>
    </Animated.View>
  );
}

function DrawBtn({
  label,
  sub,
  enabled,
  onPress,
}: {
  label: string;
  sub: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.drawBtn, !enabled && { opacity: 0.35 }]}
      onPress={enabled ? onPress : undefined}
      activeOpacity={0.85}
    >
      <Text style={styles.drawBtnLabel}>{label}</Text>
      <Text style={styles.drawBtnSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function SortPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.sortPill} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.sortPillText}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        position: "absolute",
        top: -8,
        right: -6,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: theme.bg,
        borderWidth: 1,
        borderColor: theme.gold,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      <Text style={{ color: theme.gold, fontWeight: "900", fontSize: 14 }}>?</Text>
    </TouchableOpacity>
  );
}

function ActionBtn({
  label,
  onPress,
  enabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  enabled: boolean;
  variant: "primary" | "secondary" | "gold";
}) {
  const base =
    variant === "gold"
      ? { backgroundColor: theme.gold, borderColor: theme.gold }
      : variant === "primary"
      ? { backgroundColor: theme.accent, borderColor: theme.accent }
      : { backgroundColor: theme.panel, borderColor: theme.gold };
  const textColor = variant === "secondary" ? theme.gold : variant === "gold" ? "#2a1a05" : "#fff";
  return (
    <TouchableOpacity
      activeOpacity={enabled ? 0.85 : 1}
      onPress={enabled ? onPress : undefined}
      style={[styles.actionBtn, base, !enabled && { opacity: 0.35 }]}
    >
      <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function autoSortByMelds(cards: Card[]): Card[] {
  const arr = bestArrangement(cards);
  const usedIds = new Set<string>();
  const out: Card[] = [];
  for (const meld of arr.melds) {
    for (const c of meld.cards) {
      out.push(c);
      usedIds.add(c.id);
    }
  }
  const dead = cards.filter((c) => !usedIds.has(c.id));
  dead.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
  return [...out, ...dead];
}

function canKnockNow(hand: Card[], discardCardId: string): boolean {
  const next = hand.filter((c) => c.id !== discardCardId);
  if (next.length !== 10) return false;
  return bestArrangement(next).deadwood <= 10;
}

function canGinNow(hand: Card[], discardCardId: string): boolean {
  const next = hand.filter((c) => c.id !== discardCardId);
  if (next.length !== 10) return false;
  return bestArrangement(next).deadwood === 0;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.felt, paddingHorizontal: 0 },
  loadingText: { color: theme.text, textAlign: "center", marginTop: 40, fontSize: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  metaText: { color: theme.text, fontSize: 14, fontWeight: "700" },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  pillText: { fontWeight: "800", fontSize: 14 },
  drawRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginTop: 10 },
  drawBtn: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.gold,
  },
  drawBtnLabel: { color: theme.gold, fontSize: 15, fontWeight: "900" },
  drawBtnSub: { color: theme.textDim, fontSize: 11, marginTop: 2 },
  handArea: {
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 6,
  },
  sortRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    flexWrap: "wrap",
    marginTop: 12,
  },
  sortPill: {
    backgroundColor: theme.panel,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.25)",
  },
  sortPillText: { color: theme.text, fontSize: 12, fontWeight: "700" },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  clearBtnText: { color: theme.danger, fontSize: 12, fontWeight: "700" },
  actionRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
  },
  actionBtnText: { fontWeight: "900", fontSize: 17 },
  errorToast: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: theme.danger,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  errorText: { color: "#fff", fontWeight: "700" },
});
