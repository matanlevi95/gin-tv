import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HE } from "@gin-tv/shared";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";

export function AchievementsScreen() {
  const { profile } = useGame();
  const list: { label: string; achieved: boolean }[] = [
    { label: HE.ach_firstWin, achieved: profile.firstWin },
    { label: HE.ach_firstGin, achieved: profile.firstGin },
    { label: HE.ach_threeStreak, achieved: profile.threeStreak },
    { label: HE.ach_knockWin, achieved: profile.knockWin },
    { label: HE.ach_undercut, achieved: profile.undercut },
    { label: HE.ach_10games, achieved: profile.ach10 },
    { label: HE.ach_50games, achieved: profile.ach50 },
  ];
  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {list.map((it) => (
          <View key={it.label} style={[styles.row, it.achieved && styles.rowOn]}>
            <Text style={styles.icon}>{it.achieved ? "🏆" : "🔒"}</Text>
            <Text style={[styles.label, !it.achieved && { color: theme.textDim }]}>{it.label}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: theme.panel,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  rowOn: { borderColor: theme.gold },
  icon: { fontSize: 22 },
  label: { color: theme.text, fontSize: 16, fontWeight: "700" },
});
