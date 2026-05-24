import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { theme } from "../../../theme";
import { useGame } from "../../../state/GameContext";
import { CardView } from "../../../components/CardView";
import { RootStackParamList } from "../../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "RoundResult">;

export function YanivRoundResultScreen({ navigation }: Props) {
  const {
    publicState,
    lastRoundEnd,
    playerId,
    readyNext,
    reset,
  } = useGame();

  const pub: any = publicState;
  const re: any = lastRoundEnd;
  const y = re?.yaniv;
  const me = pub?.players?.find((p: any) => p.id === playerId);
  const opp = pub?.players?.find((p: any) => p.id !== playerId);

  useEffect(() => {
    // (Stats hooks can be added later — Yaniv has its own scoring loop.)
  }, []);

  if (!re || !y) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.loading}>טוען…</Text>
      </SafeAreaView>
    );
  }

  const iCalled = y.caller === playerId;
  const iWon = y.winner === playerId;
  const isAssaf = y.reason === "assaf";
  const myValue = y.handValues?.[playerId ?? ""] ?? 0;
  const myHand: any[] = y.hands?.[playerId ?? ""] ?? [];
  const myPoints = y.pointsAwarded?.[playerId ?? ""] ?? 0;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 22 }}>
        <View style={styles.banner}>
          <Text style={[styles.bannerTitle, { color: iWon ? theme.gold : theme.textDim }]}>
            {isAssaf ? (iCalled ? "אסף! הפסדת" : "אסף! ניצחת") : iWon ? "יניב! ניצחת" : "יניב — היריב ניצח"}
          </Text>
          <Text style={styles.bannerReason}>
            {iCalled && !isAssaf
              ? "ההכרזה הצליחה — היריב מקבל את ערך היד שלו"
              : iCalled && isAssaf
              ? "הוסף ליד שלך 30 + ערך היד"
              : !iCalled && isAssaf
              ? "תפסת את היריב עם יד נמוכה"
              : "היריב הכריז יניב — קיבלת את ערך היד שלך"}
          </Text>
          <Text style={styles.points}>
            {myPoints > 0 ? `+${myPoints} ליד` : "0 נקודות"}
          </Text>
        </View>

        <View style={styles.scoreRow}>
          <ScoreBlock name={me?.name ?? "אתה"} score={me?.score ?? 0} />
          <Text style={styles.vs}>—</Text>
          <ScoreBlock name={opp?.name ?? "יריב"} score={opp?.score ?? 0} />
        </View>

        <Text style={styles.sectionTitle}>היד שלך · ערך: {myValue}</Text>
        <View style={styles.handRow}>
          {myHand.map((c: any) => (
            <CardView key={c.id} card={c} size="sm" style={{ marginLeft: 3 }} />
          ))}
        </View>

        {re.matchOver ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.gold, marginTop: 28 }]}>
              המשחק נגמר
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
            <Text style={styles.primaryBtnText}>מוכן לסיבוב נוסף</Text>
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
  bannerTitle: { fontSize: 26, fontWeight: "900" },
  bannerReason: { color: theme.textDim, fontSize: 14, marginTop: 6, textAlign: "center" },
  points: { color: theme.accent, fontSize: 22, fontWeight: "900", marginTop: 10 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginTop: 18 },
  scoreBlock: { alignItems: "center", backgroundColor: theme.panel, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 14, minWidth: 120 },
  scoreName: { color: theme.textDim, fontSize: 13 },
  scoreValue: { color: theme.goldSoft, fontSize: 28, fontWeight: "900", marginTop: 4 },
  vs: { color: theme.textDim, fontSize: 22 },
  sectionTitle: { color: theme.text, fontWeight: "700", fontSize: 16, marginTop: 22 },
  handRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  primaryBtn: { backgroundColor: theme.gold, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 28 },
  primaryBtnText: { color: "#2a1a05", fontSize: 18, fontWeight: "900" },
});
