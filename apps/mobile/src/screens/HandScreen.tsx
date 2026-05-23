import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
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
  sortByRank,
  sortBySuit,
} from "@gin-tv/shared";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";
import { CardView, CardBackView } from "../components/CardView";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Hand">;

type SortMode = "manual" | "auto" | "rank" | "suit";

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
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  // Navigate to result screen when round ends.
  useEffect(() => {
    if (lastRoundEnd) navigation.replace("RoundResult");
  }, [lastRoundEnd, navigation]);

  const me = publicState?.players.find((p) => p.id === playerId);
  const opp = publicState?.players.find((p) => p.id !== playerId);
  const isMyTurn = publicState?.currentTurn === playerId;
  const phase = publicState?.turnPhase;

  // Compute display order based on sort mode and local manual reordering.
  const handCards = useMemo<Card[]>(() => {
    if (!privateState) return [];
    const cards = privateState.hand;
    if (sortMode === "rank") return sortByRank(cards);
    if (sortMode === "suit") return sortBySuit(cards);
    if (sortMode === "auto") return autoSortByMelds(cards);
    if (sortMode === "manual" && localOrder) {
      const map = new Map(cards.map((c) => [c.id, c]));
      const ordered: Card[] = [];
      for (const id of localOrder) {
        const c = map.get(id);
        if (c) ordered.push(c);
      }
      // Append any new cards (e.g., just drew) that aren't yet in the order.
      for (const c of cards) if (!localOrder.includes(c.id)) ordered.push(c);
      return ordered;
    }
    return cards;
  }, [privateState, sortMode, localOrder]);

  // Keep server in sync on manual reorder.
  useEffect(() => {
    if (sortMode === "manual" && localOrder && privateState && handCards.length === privateState.hand.length) {
      const ids = handCards.map((c) => c.id);
      reorderHand(ids);
    }
  }, [handCards, sortMode, localOrder, privateState, reorderHand]);

  const onSelect = useCallback(
    (cardId: string) => {
      Haptics.selectionAsync().catch(() => {});
      setSelectedId((prev) => (prev === cardId ? null : cardId));
    },
    []
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

  const moveCard = useCallback(
    (cardId: string, dir: -1 | 1) => {
      Haptics.selectionAsync().catch(() => {});
      // Switch to manual mode and seed localOrder from current display order.
      setSortMode("manual");
      const order = (localOrder ?? handCards.map((c) => c.id)).slice();
      const idx = order.indexOf(cardId);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= order.length) return;
      [order[idx], order[next]] = [order[next], order[idx]];
      setLocalOrder(order);
    },
    [handCards, localOrder]
  );

  // Pulse the "your turn" pill while it's your turn.
  const turnPulse = useSharedValue(0);
  useEffect(() => {
    if (isMyTurn) {
      turnPulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      turnPulse.value = withTiming(0, { duration: 200 });
    }
  }, [isMyTurn, turnPulse]);
  const turnPulseStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * turnPulse.value,
    transform: [{ scale: 1 + 0.06 * turnPulse.value }],
  }));

  // Score pop when my score changes.
  const myScorePop = useSharedValue(1);
  const lastMyScore = React.useRef(me?.score ?? 0);
  useEffect(() => {
    const s = me?.score ?? 0;
    if (s !== lastMyScore.current) {
      myScorePop.value = withSequence(
        withTiming(1.4, { duration: 180 }),
        withTiming(1, { duration: 220 })
      );
      lastMyScore.current = s;
    }
  }, [me?.score, myScorePop]);
  const myScorePopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: myScorePop.value }],
  }));

  if (!publicState || !privateState || !me) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.loadingText}>{HE.loading}</Text>
      </SafeAreaView>
    );
  }

  const canDiscard = isMyTurn && phase === "discard" && !!selectedId;
  const canKnock = isMyTurn && phase === "discard" && !!selectedId && privateState.hand.length === 11 && canKnockNow(privateState.hand, selectedId);
  const canGin = isMyTurn && phase === "discard" && !!selectedId && privateState.hand.length === 11 && canGinNow(privateState.hand, selectedId);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.opponent}>
            {opp?.name ?? HE.opponent}: <Text style={styles.score}>{opp?.score ?? 0}</Text>
          </Text>
          <Text style={styles.myLine}>
            {HE.you}: <Animated.Text style={[styles.score, myScorePopStyle]}>{me.score}</Animated.Text>
          </Text>
        </View>
        <View style={styles.turnBox}>
          <View style={{ position: "relative", alignItems: "flex-end" }}>
            {isMyTurn && (
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: -6,
                    left: -10,
                    right: -10,
                    bottom: -6,
                    borderRadius: 14,
                    backgroundColor: "rgba(212, 168, 91, 0.18)",
                    borderWidth: 1,
                    borderColor: theme.gold,
                  },
                  turnPulseStyle,
                ]}
              />
            )}
            <Text style={[styles.turnText, { color: isMyTurn ? theme.gold : theme.textDim }]}>
              {isMyTurn ? HE.yourTurn : HE.opponentsTurn}
            </Text>
            {isMyTurn && (
              <Text style={styles.phaseText}>
                {phase === "draw" ? "קח קלף" : "זרוק קלף"}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Center: draw / discard area */}
      <View style={styles.centerArea}>
        <Pressable
          disabled={!isMyTurn || phase !== "draw"}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            drawDeck();
          }}
          style={({ pressed }) => [
            styles.pile,
            (!isMyTurn || phase !== "draw") && { opacity: 0.4 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <CardBackView size="lg" />
          <Text style={styles.pileLabel}>{HE.drawDeck}</Text>
          <Text style={styles.pileCount}>{publicState.deckCount}</Text>
        </Pressable>

        <Pressable
          disabled={!isMyTurn || phase !== "draw" || !publicState.discardTop}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            drawDiscard();
          }}
          style={({ pressed }) => [
            styles.pile,
            (!isMyTurn || phase !== "draw" || !publicState.discardTop) && { opacity: 0.4 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          {publicState.discardTop ? (
            <CardView card={publicState.discardTop} size="lg" />
          ) : (
            <View style={{ width: 80, height: 116 }} />
          )}
          <Text style={styles.pileLabel}>{HE.drawDiscard}</Text>
          <Text style={styles.pileCount}>{publicState.discardCount}</Text>
        </Pressable>
      </View>

      {/* Deadwood / melds info */}
      <View style={styles.deadwoodRow}>
        <Text style={styles.deadwoodText}>
          {HE.deadwood}: <Text style={styles.deadwoodValue}>{privateState.deadwood}</Text>
        </Text>
        <Text style={styles.meldsHint}>
          {privateState.melds.length > 0
            ? `${privateState.melds.length} סדרות מוצעות`
            : "אין סדרות מוצעות"}
        </Text>
      </View>

      {/* Hand */}
      <View style={styles.handWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handRow}>
          {handCards.map((c) => (
            <View key={c.id} style={styles.cardSlot}>
              <Pressable onPress={() => onSelect(c.id)} onLongPress={() => onSelect(c.id)}>
                <CardView card={c} size="md" selected={selectedId === c.id} />
              </Pressable>
              <View style={styles.moveRow}>
                <TouchableOpacity style={styles.moveBtn} onPress={() => moveCard(c.id, -1)}>
                  <Text style={styles.moveBtnText}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moveBtn} onPress={() => moveCard(c.id, 1)}>
                  <Text style={styles.moveBtnText}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Sort row */}
      <View style={styles.sortRow}>
        <SortPill label={HE.autoSort} active={sortMode === "auto"} onPress={() => { setSortMode("auto"); setLocalOrder(null); }} />
        <SortPill label={HE.sortByRank} active={sortMode === "rank"} onPress={() => { setSortMode("rank"); setLocalOrder(null); }} />
        <SortPill label={HE.sortBySuit} active={sortMode === "suit"} onPress={() => { setSortMode("suit"); setLocalOrder(null); }} />
        {selectedId && (
          <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>{HE.clearSelection}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Helper text */}
      <Text style={styles.helper}>
        {!isMyTurn
          ? HE.waitingOpponent
          : phase === "draw"
          ? "בחר קופה או זריקה"
          : HE.helperSelectDiscard}
      </Text>

      {/* Action row */}
      <View style={styles.actionRow}>
        <ActionBtn label={HE.knock} onPress={onKnock} enabled={canKnock} variant="secondary" />
        <ActionBtn label={HE.discard} onPress={onDiscard} enabled={canDiscard} variant="primary" />
        <ActionBtn label={HE.gin} onPress={onGin} enabled={canGin} variant="gold" />
      </View>

      {errorMessage && (
        <View style={styles.errorToast}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function SortPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.pillText, active && { color: "#2a1a05" }]}>{label}</Text>
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
  const textColor =
    variant === "secondary" ? theme.gold : variant === "gold" ? "#2a1a05" : "#fff";
  return (
    <TouchableOpacity
      activeOpacity={enabled ? 0.85 : 1}
      onPress={enabled ? onPress : undefined}
      style={[
        styles.actionBtn,
        base,
        !enabled && { opacity: 0.35 },
      ]}
    >
      <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---- Helpers ----

function autoSortByMelds(cards: Card[]): Card[] {
  const arr = bestArrangement(cards);
  const usedIds = new Set<string>();
  const out: Card[] = [];
  for (const meld of arr.melds) {
    for (const c of meld.cards) {
      out.push(c);
      usedIds.add(c.id);
    }
    // separator handled visually by group; we just keep them adjacent
  }
  // Append deadwood at the end, sorted by rank.
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
  root: { flex: 1, backgroundColor: theme.felt, paddingHorizontal: 10 },
  loadingText: { color: theme.text, textAlign: "center", marginTop: 40, fontSize: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerLeft: { gap: 2 },
  opponent: { color: theme.textDim, fontSize: 14 },
  myLine: { color: theme.text, fontSize: 16, fontWeight: "700" },
  score: { color: theme.goldSoft, fontWeight: "800" },
  turnBox: { alignItems: "flex-end" },
  turnText: { fontSize: 16, fontWeight: "800" },
  phaseText: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  centerArea: {
    flexDirection: "row",
    gap: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
    marginTop: 4,
  },
  pile: { alignItems: "center" },
  pileLabel: { color: theme.text, fontSize: 13, marginTop: 6 },
  pileCount: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  deadwoodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    marginTop: 8,
  },
  deadwoodText: { color: theme.text, fontSize: 14, fontWeight: "700" },
  deadwoodValue: { color: theme.goldSoft, fontWeight: "900" },
  meldsHint: { color: theme.textDim, fontSize: 13 },
  handWrap: {
    marginTop: 12,
    paddingVertical: 6,
  },
  handRow: {
    paddingHorizontal: 6,
    paddingVertical: 22,
    alignItems: "flex-end",
    gap: 4,
  },
  cardSlot: { alignItems: "center", marginHorizontal: 1 },
  moveRow: { flexDirection: "row", gap: 4, marginTop: 6 },
  moveBtn: {
    backgroundColor: theme.panel,
    width: 26,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.25)",
  },
  moveBtnText: { color: theme.text, fontSize: 16, fontWeight: "800" },
  sortRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    marginTop: 4,
    flexWrap: "wrap",
  },
  pill: {
    backgroundColor: theme.panel,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.25)",
  },
  pillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
  pillText: { color: theme.text, fontSize: 13, fontWeight: "700" },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  clearBtnText: { color: theme.danger, fontSize: 13, fontWeight: "700" },
  helper: { color: theme.textDim, textAlign: "center", marginTop: 8, fontSize: 13 },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 8,
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
