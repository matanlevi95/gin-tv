import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";

export function HistoryScreen() {
  const { history } = useGame();
  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {history.length === 0 && (
          <Text style={styles.empty}>אין עדיין משחקים. תתחיל לשחק! 🎴</Text>
        )}
        {history.map((h) => (
          <View key={h.date} style={[styles.row, h.won && styles.rowWon]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.opp}>נגד {h.opponent}</Text>
              <Text style={styles.date}>{new Date(h.date).toLocaleString("he-IL")}</Text>
            </View>
            <Text style={[styles.result, { color: h.won ? theme.gold : theme.danger }]}>
              {h.won ? "ניצחון" : "הפסד"}
            </Text>
            <Text style={styles.score}>{h.finalScore}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  empty: { color: theme.textDim, textAlign: "center", marginTop: 40, fontSize: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.panel,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  rowWon: { borderColor: theme.gold },
  opp: { color: theme.text, fontWeight: "700", fontSize: 16 },
  date: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  result: { fontWeight: "900", fontSize: 14 },
  score: { color: theme.goldSoft, fontWeight: "900", fontSize: 18 },
});
