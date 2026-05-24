import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HE } from "@gin-tv/shared";
import { theme } from "../../../theme";
import { useGame } from "../../../state/GameContext";
import { CardView } from "../../../components/CardView";
import { RootStackParamList } from "../../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "RoundResult">;

export function RoundResultScreen({ navigation }: Props) {
  const {
    publicState,
    lastRoundEnd,
    playerId,
    readyNext,
    profile,
    setProfile,
    addHistory,
    reset,
  } = useGame();

  // Update stats once when results arrive
  useEffect(() => {
    if (!lastRoundEnd || !playerId) return;
    const won = lastRoundEnd.winner === playerId;
    const opp = publicState?.players.find((p) => p.id !== playerId);
    if (lastRoundEnd.matchOver) {
      const updated = { ...profile };
      updated.gamesPlayed += 1;
      if (won) {
        updated.totalWins += 1;
        updated.winStreak += 1;
        if (!updated.firstWin) updated.firstWin = true;
        if (lastRoundEnd.reason === "gin" && !updated.firstGin) updated.firstGin = true;
        if (lastRoundEnd.reason === "knock" && !updated.knockWin) updated.knockWin = true;
        if (lastRoundEnd.reason === "undercut" && !updated.undercut) updated.undercut = true;
        if (updated.winStreak >= 3) updated.threeStreak = true;
      } else {
        updated.winStreak = 0;
      }
      if (updated.gamesPlayed >= 10) updated.ach10 = true;
      if (updated.gamesPlayed >= 50) updated.ach50 = true;
      setProfile(updated);
      addHistory({
        date: Date.now(),
        opponent: opp?.name ?? "יריב",
        won,
        finalScore: lastRoundEnd.totals[playerId] ?? 0,
      });
    }
  }, [lastRoundEnd?.matchOver]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lastRoundEnd || !publicState) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.loading}>{HE.loading}</Text>
      </SafeAreaView>
    );
  }

  const cancelled = lastRoundEnd.reason === "cancelled";
  const won = !cancelled && lastRoundEnd.winner === playerId;
  const opp = publicState.players.find((p) => p.id !== playerId);
  const me = publicState.players.find((p) => p.id === playerId);
  const myDead = lastRoundEnd.deadwood[playerId ?? ""] ?? 0;
  const myHand = lastRoundEnd.hands[playerId ?? ""] ?? [];

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 22 }}>
        <View style={styles.banner}>
          {cancelled ? (
            <>
              <Text style={[styles.bannerTitle, { color: theme.textDim }]}>
                {HE.roundCancelled}
              </Text>
              <Text style={styles.bannerReason}>סיבוב חדש בקרוב</Text>
            </>
          ) : (
            <>
              <Text style={[styles.bannerTitle, { color: won ? theme.gold : theme.textDim }]}>
                {won ? "ניצחת! 🏆" : "הפסדת"}
              </Text>
              <Text style={styles.bannerReason}>
                {lastRoundEnd.reason === "gin" && `${HE.gin}!`}
                {lastRoundEnd.reason === "undercut" && HE.undercut}
                {lastRoundEnd.reason === "knock" && HE.knock}
              </Text>
              <Text style={styles.points}>
                {won ? "+" : ""}
                {won ? lastRoundEnd.pointsAwarded : 0} {HE.pointsGained}
              </Text>
            </>
          )}
        </View>

        <View style={styles.scoreRow}>
          <ScoreBlock name={me?.name ?? HE.you} score={me?.score ?? 0} />
          <Text style={styles.vs}>—</Text>
          <ScoreBlock name={opp?.name ?? HE.opponent} score={opp?.score ?? 0} />
        </View>

        <Text style={styles.sectionTitle}>היד שלך · {HE.deadwood} {myDead}</Text>
        <View style={styles.handRow}>
          {myHand.map((c) => (
            <CardView key={c.id} card={c} size="sm" style={{ marginLeft: 3 }} />
          ))}
        </View>

        {lastRoundEnd.matchOver ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.gold, marginTop: 28 }]}>
              {HE.matchOver}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                reset();
                navigation.popToTop();
              }}
            >
              <Text style={styles.primaryBtnText}>חזרה לבית</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              readyNext();
              navigation.replace("Hand");
            }}
          >
            <Text style={styles.primaryBtnText}>{HE.readyNext}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScoreBlock({ name, score }: { name: string; score: number }) {
  return (
    <View style={styles.scoreBlock}>
      <Text style={styles.scoreName}>{name}</Text>
      <Text style={styles.scoreValue}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  loading: { color: theme.text, textAlign: "center", marginTop: 40, fontSize: 20 },
  banner: {
    alignItems: "center",
    backgroundColor: theme.panel,
    padding: 22,
    borderRadius: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.25)",
  },
  bannerTitle: { fontSize: 32, fontWeight: "900" },
  bannerReason: { color: theme.textDim, fontSize: 16, marginTop: 4 },
  points: { color: theme.accent, fontSize: 24, fontWeight: "900", marginTop: 10 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 18,
  },
  scoreBlock: {
    alignItems: "center",
    backgroundColor: theme.panel,
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 14,
    minWidth: 120,
  },
  scoreName: { color: theme.textDim, fontSize: 13 },
  scoreValue: { color: theme.goldSoft, fontSize: 28, fontWeight: "900", marginTop: 4 },
  vs: { color: theme.textDim, fontSize: 22 },
  sectionTitle: { color: theme.text, fontWeight: "700", fontSize: 16, marginTop: 22 },
  handRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  primaryBtn: {
    backgroundColor: theme.gold,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  primaryBtnText: { color: "#2a1a05", fontSize: 18, fontWeight: "900" },
});
