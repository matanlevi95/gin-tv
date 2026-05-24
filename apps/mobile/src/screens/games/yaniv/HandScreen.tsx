import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isLegalDiscard, handValue, YANIV_THRESHOLD } from "@gin-tv/shared";
import { theme } from "../../../theme";
import { useGame } from "../../../state/GameContext";
import { CardView, CardBackView } from "../../../components/CardView";
import { RootStackParamList } from "../../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Hand">;

export function YanivHandScreen({ navigation }: Props) {
  const {
    publicState,
    privateState,
    playerId,
    sendGameAction,
    errorMessage,
    lastRoundEnd,
  } = useGame();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Navigate to result screen when round ends.
  useEffect(() => {
    if (lastRoundEnd) navigation.replace("RoundResult");
  }, [lastRoundEnd, navigation]);

  const pub: any = publicState;
  const priv: any = privateState;
  const me = pub?.players?.find((p: any) => p.id === playerId);
  const opp = pub?.players?.find((p: any) => p.id !== playerId);
  const isMyTurn = pub?.currentTurn === playerId;
  const phase: "discard" | "draw" | null = pub?.turnPhase ?? null;
  const hand: any[] = priv?.hand ?? [];
  const hv: number = priv?.handValue ?? 0;

  const toggle = useCallback(
    (id: string) => {
      Haptics.selectionAsync().catch(() => {});
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    []
  );

  const selectedCards = useMemo(() => hand.filter((c) => selected.has(c.id)), [hand, selected]);
  const canDiscard = isMyTurn && phase === "discard" && selectedCards.length > 0 && isLegalDiscard(selectedCards as any);
  const canDrawDeck = isMyTurn && phase === "draw";
  const canDrawDiscard = isMyTurn && phase === "draw" && (pub?.lastDiscardGroup?.length ?? 0) > 0;
  const canCallYaniv = isMyTurn && phase === "discard" && hv <= YANIV_THRESHOLD;

  const onDiscard = useCallback(() => {
    if (!canDiscard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    sendGameAction("yaniv", { kind: "discard_group", cardIds: Array.from(selected) });
    setSelected(new Set());
  }, [canDiscard, selected, sendGameAction]);

  const onDrawDeck = useCallback(() => {
    if (!canDrawDeck) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendGameAction("yaniv", { kind: "draw_deck" });
  }, [canDrawDeck, sendGameAction]);

  const onDrawDiscard = useCallback(() => {
    if (!canDrawDiscard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendGameAction("yaniv", { kind: "draw_discard" });
  }, [canDrawDiscard, sendGameAction]);

  const onCallYaniv = useCallback(() => {
    if (!canCallYaniv) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    sendGameAction("yaniv", { kind: "call_yaniv" });
  }, [canCallYaniv, sendGameAction]);

  if (!pub || !priv || !me) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.loadingText}>טוען…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.opponent}>
            {opp?.name ?? "יריב"}: <Text style={styles.score}>{opp?.score ?? 0}</Text>
          </Text>
          <Text style={styles.myLine}>
            אתה: <Text style={styles.score}>{me.score}</Text>
          </Text>
        </View>
        <View style={styles.turnBox}>
          <Text style={[styles.turnText, { color: isMyTurn ? theme.gold : theme.textDim }]}>
            {isMyTurn ? "התור שלך" : "ממתין ליריב"}
          </Text>
          {isMyTurn && (
            <Text style={styles.phaseText}>
              {phase === "discard" ? "זרוק או הכרז יניב" : "קח קלף"}
            </Text>
          )}
        </View>
      </View>

      {/* Center: discard top group + deck */}
      <View style={styles.centerArea}>
        <Pressable
          disabled={!canDrawDeck}
          onPress={onDrawDeck}
          style={({ pressed }) => [
            styles.pile,
            !canDrawDeck && { opacity: 0.35 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <CardBackView size="lg" />
          <Text style={styles.pileLabel}>קופה</Text>
          <Text style={styles.pileCount}>{pub.deckCount}</Text>
        </Pressable>

        <Pressable
          disabled={!canDrawDiscard}
          onPress={onDrawDiscard}
          style={({ pressed }) => [
            styles.pile,
            { flexDirection: "row", gap: 4 } as any,
            !canDrawDiscard && { opacity: 0.35 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <View style={{ flexDirection: "row" }}>
            {(pub.lastDiscardGroup ?? []).slice(-3).map((c: any) => (
              <CardView key={c.id} card={c} size="md" style={{ marginLeft: -10 }} />
            ))}
          </View>
        </Pressable>
      </View>
      <Text style={{ color: theme.textDim, textAlign: "center", marginTop: 4 }}>
        ערך יד: <Text style={{ color: hv <= 7 ? theme.accent : theme.text, fontWeight: "900", fontSize: 18 }}>{hv}</Text>
        {hv <= 7 && <Text style={{ color: theme.accent }}>  · אפשר להכריז יניב!</Text>}
      </Text>

      {/* Hand */}
      <View style={styles.handWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handRow}>
          {hand.map((c) => (
            <Pressable key={c.id} onPress={() => toggle(c.id)} style={{ marginHorizontal: 3 }}>
              <CardView card={c} size="md" selected={selected.has(c.id)} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Selection helper */}
      {selectedCards.length > 0 && (
        <Text style={styles.helper}>
          נבחרו {selectedCards.length} קלפים — {canDiscard ? "צירוף חוקי, אפשר לזרוק" : "צירוף לא חוקי"}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <ActionBtn label="הכרז יניב" onPress={onCallYaniv} enabled={canCallYaniv} variant="gold" />
        <ActionBtn label="זרוק" onPress={onDiscard} enabled={canDiscard} variant="primary" />
        {selected.size > 0 && (
          <TouchableOpacity onPress={() => setSelected(new Set())} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>בטל בחירה</Text>
          </TouchableOpacity>
        )}
      </View>

      {errorMessage && (
        <View style={styles.errorToast}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </SafeAreaView>
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
    gap: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  pile: { alignItems: "center" },
  pileLabel: { color: theme.text, fontSize: 13, marginTop: 6 },
  pileCount: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  handWrap: { marginTop: 12, paddingVertical: 6 },
  handRow: { paddingHorizontal: 6, paddingVertical: 22, alignItems: "flex-end", gap: 4 },
  helper: { color: theme.textDim, textAlign: "center", marginTop: 6, fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 8, marginTop: 10, marginBottom: 8 },
  actionBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 12, borderWidth: 2 },
  actionBtnText: { fontWeight: "900", fontSize: 17 },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.danger,
  },
  clearBtnText: { color: theme.danger, fontSize: 14, fontWeight: "700" },
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
