/**
 * Yaniv Hand Controller — same UX principles as Gin:
 *  • Phone shows ONLY the hand + actions; deck/discard are on the TV.
 *  • All cards fit on screen without scrolling.
 *  • Drag-and-drop reorder (long-press to grab).
 *  • Hand value updates live based on what's in the hand.
 *  • Selection is MULTI (you pick a legal group: single, set, run).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  withRepeat,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Card,
  RANK_ORDER,
  cardValue,
  handValue as computeHandValue,
  isLegalDiscard,
  sortByRank,
  sortBySuit,
  YANIV_THRESHOLD,
} from "@gin-tv/shared";
import { theme } from "../../../theme";
import { useGame } from "../../../state/GameContext";
import { CardView } from "../../../components/CardView";
import { RootStackParamList } from "../../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Hand">;

const SCREEN_W = Dimensions.get("window").width;
const CARD_W = 62;
const CARD_H = 90;
const CARD_OVERLAP = 38; // Yaniv hands are smaller (5-7), so wider visible per card

export function YanivHandScreen({ navigation }: Props) {
  const { publicState, privateState, playerId, sendGameAction, errorMessage, lastRoundEnd } =
    useGame();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  useEffect(() => {
    if (lastRoundEnd) navigation.replace("RoundResult");
  }, [lastRoundEnd, navigation]);

  const pub: any = publicState;
  const priv: any = privateState;
  const me = pub?.players?.find((p: any) => p.id === playerId);
  const isMyTurn = pub?.currentTurn === playerId;
  const phase: "discard" | "draw" | null = pub?.turnPhase ?? null;

  // Sync localOrder when server hand changes
  useEffect(() => {
    const serverIds: string[] = priv?.hand?.map((c: Card) => c.id) ?? [];
    if (serverIds.length === 0) {
      setLocalOrder(null);
      return;
    }
    if (!localOrder) {
      setLocalOrder(serverIds);
      return;
    }
    const ss = new Set(serverIds);
    const filtered = localOrder.filter((id) => ss.has(id));
    const ls = new Set(filtered);
    const appended = serverIds.filter((id) => !ls.has(id));
    const next = [...filtered, ...appended];
    if (next.length !== localOrder.length || next.some((id, i) => id !== localOrder[i])) {
      setLocalOrder(next);
      // Clear selection of cards that left the hand
      setSelectedIds((prev) => {
        const out = new Set<string>();
        for (const id of prev) if (ss.has(id)) out.add(id);
        return out;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priv?.hand]);

  const hand = useMemo<Card[]>(() => {
    if (!priv) return [];
    const map = new Map<string, Card>(priv.hand.map((c: Card) => [c.id, c]));
    const order = localOrder ?? priv.hand.map((c: Card) => c.id);
    const out: Card[] = [];
    for (const id of order) {
      const c = map.get(id);
      if (c) out.push(c);
    }
    return out;
  }, [priv, localOrder]);

  const hv = useMemo(() => computeHandValue(hand), [hand]);
  const selectedCards = useMemo(() => hand.filter((c) => selectedIds.has(c.id)), [hand, selectedIds]);
  const selectionLegal = selectedCards.length > 0 && isLegalDiscard(selectedCards);

  const pushReorder = useCallback(
    (order: string[]) => {
      setLocalOrder(order);
      // Yaniv doesn't have a reorder action on the server — order is local visual only.
    },
    []
  );

  const onTap = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSort = useCallback(
    (mode: "rank" | "suit") => {
      Haptics.selectionAsync().catch(() => {});
      const sorted = mode === "rank" ? sortByRank(hand) : sortBySuit(hand);
      pushReorder(sorted.map((c) => c.id));
    },
    [hand, pushReorder]
  );

  const onDiscardGroup = useCallback(() => {
    if (!selectionLegal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    sendGameAction("yaniv", { kind: "discard_group", cardIds: Array.from(selectedIds) });
    setSelectedIds(new Set());
  }, [selectionLegal, selectedIds, sendGameAction]);

  const onDrawDeck = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendGameAction("yaniv", { kind: "draw_deck" });
  }, [sendGameAction]);

  const onDrawDiscard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendGameAction("yaniv", { kind: "draw_discard" });
  }, [sendGameAction]);

  const onCallYaniv = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    sendGameAction("yaniv", { kind: "call_yaniv" });
  }, [sendGameAction]);

  if (!pub || !priv || !me) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.loadingText}>טוען…</Text>
      </SafeAreaView>
    );
  }

  const canCallYaniv = isMyTurn && phase === "discard" && hv <= YANIV_THRESHOLD;
  const canDiscard = isMyTurn && phase === "discard" && selectionLegal;
  const canDrawDeck = isMyTurn && phase === "draw";
  const canDrawDiscard = isMyTurn && phase === "draw" && (pub.lastDiscardGroup?.length ?? 0) > 0;

  const totalWidth = CARD_OVERLAP * (hand.length - 1) + CARD_W;
  const startX = Math.max(8, (SCREEN_W - totalWidth) / 2);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        {/* Header: turn pill + hand value */}
        <View style={styles.headerRow}>
          <TurnPill mine={isMyTurn} phase={phase} />
          <Text style={styles.metaText}>
            ערך יד:{" "}
            <Text
              style={{
                color: hv <= YANIV_THRESHOLD ? theme.accent : theme.text,
                fontWeight: "900",
              }}
            >
              {hv}
            </Text>
            {hv <= YANIV_THRESHOLD && (
              <Text style={{ color: theme.accent, fontSize: 12 }}>  · אפשר יניב!</Text>
            )}
          </Text>
        </View>

        {/* Draw buttons */}
        <View style={styles.drawRow}>
          <DrawBtn
            label="קח מהקופה"
            sub={`קופה (${pub.deckCount})`}
            enabled={canDrawDeck}
            onPress={onDrawDeck}
          />
          <DrawBtn
            label="קח מהזריקה"
            sub="זריקה — ראה ב-TV"
            enabled={canDrawDiscard}
            onPress={onDrawDiscard}
          />
        </View>

        {/* Hand */}
        <View style={styles.handArea}>
          <DraggableHand
            hand={hand}
            startX={startX}
            cardW={CARD_W}
            cardOverlap={CARD_OVERLAP}
            cardH={CARD_H}
            selectedIds={selectedIds}
            selectionLegal={selectionLegal}
            onTap={onTap}
            onReorder={pushReorder}
          />
        </View>

        {/* Sort row */}
        <View style={styles.sortRow}>
          <SortPill label="לפי מספר" onPress={() => onSort("rank")} />
          <SortPill label="לפי צורה" onPress={() => onSort("suit")} />
          {selectedIds.size > 0 && (
            <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>בטל בחירה</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Helper */}
        <Text style={styles.helper}>
          {!isMyTurn
            ? "ממתין ליריב"
            : phase === "draw"
            ? "קח קלף — מהקופה או מהזריקה"
            : selectedIds.size === 0
            ? "בחר קלפים לזרוק (1, סדרה, או רביעייה)"
            : selectionLegal
            ? "צירוף חוקי — לחץ זרוק"
            : "צירוף לא חוקי. בחר קלף אחד, אותו ערך, או רצף באותה צורה"}
        </Text>

        {/* Actions */}
        <View style={styles.actionRow}>
          <ActionBtn label="הכרז יניב" onPress={onCallYaniv} enabled={canCallYaniv} variant="gold" />
          <ActionBtn label="זרוק" onPress={onDiscardGroup} enabled={canDiscard} variant="primary" />
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

/* ---------------- DraggableHand (Yaniv variant: multi-select) ---------------- */

function DraggableHand({
  hand,
  startX,
  cardW,
  cardOverlap,
  cardH,
  selectedIds,
  selectionLegal,
  onTap,
  onReorder,
}: {
  hand: Card[];
  startX: number;
  cardW: number;
  cardOverlap: number;
  cardH: number;
  selectedIds: Set<string>;
  selectionLegal: boolean;
  onTap: (id: string) => void;
  onReorder: (order: string[]) => void;
}) {
  return (
    <View style={{ width: "100%", height: cardH + 50, position: "relative" }}>
      {hand.map((c, i) => (
        <CardSlot
          key={c.id}
          card={c}
          index={i}
          handLength={hand.length}
          startX={startX}
          cardW={cardW}
          cardOverlap={cardOverlap}
          selected={selectedIds.has(c.id)}
          legalColor={selectionLegal ? theme.accent : undefined}
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
  startX,
  cardW,
  cardOverlap,
  selected,
  legalColor,
  onTap,
  onDragEnd,
}: {
  card: Card;
  index: number;
  handLength: number;
  startX: number;
  cardW: number;
  cardOverlap: number;
  selected: boolean;
  legalColor: string | undefined;
  onTap: () => void;
  onDragEnd: (newIndex: number) => void;
}) {
  const baseX = startX + index * cardOverlap;
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const z = useSharedValue(index);

  useEffect(() => {
    tx.value = withSpring(0, { damping: 18, stiffness: 220 });
    ty.value = withSpring(0, { damping: 18, stiffness: 220 });
    z.value = index;
  }, [index, tx, ty, z]);

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      ty.value = withSpring(-30, { damping: 14, stiffness: 220 });
      z.value = 999;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
    })
    .onEnd(() => {
      const dropX = baseX + tx.value;
      let target = Math.round((dropX - startX) / cardOverlap);
      if (target < 0) target = 0;
      if (target > handLength - 1) target = handLength - 1;
      tx.value = withSpring(0, { damping: 18, stiffness: 220 });
      ty.value = withSpring(0, { damping: 18, stiffness: 220 });
      runOnJS(onDragEnd)(target);
    });

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(onTap)();
  });
  const composed = Gesture.Simultaneous(pan, tap);

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
            top: 10,
            width: cardW,
          },
          animatedStyle,
        ]}
      >
        <CardView card={card} size="md" selected={selected} meldColor={selected ? legalColor : undefined} />
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
  const style = useAnimatedStyle(() => ({ opacity: 0.6 + 0.4 * pulse.value }));
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
        {mine ? `התור שלך · ${phase === "draw" ? "קח" : "זרוק"}` : "ממתין ליריב"}
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

function ActionBtn({
  label,
  onPress,
  enabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  enabled: boolean;
  variant: "primary" | "gold";
}) {
  const base =
    variant === "gold"
      ? { backgroundColor: theme.gold, borderColor: theme.gold }
      : { backgroundColor: theme.accent, borderColor: theme.accent };
  const textColor = variant === "gold" ? "#2a1a05" : "#fff";
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.felt, paddingHorizontal: 8 },
  loadingText: { color: theme.text, textAlign: "center", marginTop: 40, fontSize: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  metaText: { color: theme.text, fontSize: 14, fontWeight: "700" },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  pillText: { fontWeight: "800", fontSize: 14 },
  drawRow: { flexDirection: "row", gap: 8, paddingHorizontal: 8, marginTop: 10 },
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
    flex: 1,
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  sortRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    flexWrap: "wrap",
    marginTop: 4,
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
  helper: { color: theme.textDim, textAlign: "center", marginTop: 6, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 6, paddingHorizontal: 8, marginTop: 8, marginBottom: 8 },
  actionBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 12, borderWidth: 2 },
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
