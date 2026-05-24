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
const CARDS_PER_ROW = 6;
const SIDE_PAD = 12;
const COL_GAP = 4;
const ROW_GAP = 14;
const CARD_W = Math.floor(
  (SCREEN_W - SIDE_PAD * 2 - COL_GAP * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW
);
const CARD_H = Math.round(CARD_W * 1.45);

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

  const showYanivInfo = () => {
    Alert.alert(
      "מה זה יניב?",
      `אפשר להכריז 'יניב' רק כשערך היד שלך ≤ 7.\n\nאם הכרזת:\n• היריב מקבל ניקוד = ערך היד שלו (אתה 0).\n• אם ליריב יד שווה או נמוכה משלך → אסף! אתה לוקח 30 + ערך היד שלך, היריב 0.\n\nהמטרה: לסיים את המשחק עם הכי פחות נקודות.\nמי שמגיע ל-100 — מפסיד את המשחק.`
    );
  };

  const rows = Math.ceil(hand.length / CARDS_PER_ROW);
  const gridHeight = rows * CARD_H + (rows - 1) * ROW_GAP;

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
        <View style={[styles.handArea, { height: gridHeight + 20 }]}>
          <GridHand
            hand={hand}
            cardW={CARD_W}
            cardH={CARD_H}
            gridWidth={SCREEN_W}
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
          <View style={{ flex: 1, position: "relative" }}>
            <ActionBtn label="הכרז יניב" onPress={onCallYaniv} enabled={canCallYaniv} variant="gold" />
            <TouchableOpacity
              onPress={showYanivInfo}
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
          </View>
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

/* ---------------- GridHand (Yaniv: multi-select) ---------------- */

function GridHand({
  hand,
  cardW,
  cardH,
  gridWidth,
  selectedIds,
  selectionLegal,
  onTap,
  onReorder,
}: {
  hand: Card[];
  cardW: number;
  cardH: number;
  gridWidth: number;
  selectedIds: Set<string>;
  selectionLegal: boolean;
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
  slotW,
  slotH,
  selected,
  legalColor,
  onTap,
  onDragEnd,
}: {
  card: Card;
  index: number;
  handLength: number;
  slotW: number;
  slotH: number;
  selected: boolean;
  legalColor: string | undefined;
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
      const dropX = baseX + tx.value;
      const dropY = baseY + ty.value;
      const newCol = Math.round((dropX - SIDE_PAD) / slotW);
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
          meldColor={selected ? legalColor : undefined}
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
    justifyContent: "center",
    marginTop: 24,
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
