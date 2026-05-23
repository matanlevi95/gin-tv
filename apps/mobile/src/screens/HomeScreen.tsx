import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HE } from "@gin-tv/shared";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const { profile } = useGame();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.avatarLetter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.greeting}>שלום וברוכים הבאים</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.titleGold}>ג׳ין</Text>
            <Text style={styles.titleCream}>TV</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label={HE.totalWins} value={profile.totalWins} />
          <Stat label={HE.winStreak} value={profile.winStreak} />
          <Stat label={HE.gamesPlayed} value={profile.gamesPlayed} />
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Scan")}
        >
          <Text style={styles.primaryBtnText}>{HE.joinTv}</Text>
        </TouchableOpacity>

        <View style={{ height: 18 }} />

        <Tile label={HE.myProfile} onPress={() => navigation.navigate("Profile")} />
        <Tile label={HE.achievements} onPress={() => navigation.navigate("Achievements")} />
        <Tile label={HE.matchHistory} onPress={() => navigation.navigate("History")} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tile} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.tileText}>{label}</Text>
      <Text style={styles.tileChev}>‹</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 22,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "900", color: "#2a1a05" },
  name: { color: theme.text, fontWeight: "800", fontSize: 22 },
  greeting: { color: theme.textDim, fontSize: 14, marginTop: 2 },
  titleBlock: { alignItems: "flex-end" },
  titleGold: { color: theme.gold, fontSize: 26, fontWeight: "900" },
  titleCream: { color: theme.text, fontSize: 22, fontWeight: "900", marginTop: -4 },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  stat: {
    flex: 1,
    backgroundColor: theme.panel,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.2)",
  },
  statValue: { color: theme.goldSoft, fontSize: 26, fontWeight: "900" },
  statLabel: { color: theme.textDim, marginTop: 4, fontSize: 12 },
  primaryBtn: {
    backgroundColor: theme.gold,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: theme.gold,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  primaryBtnText: { color: "#2a1a05", fontWeight: "900", fontSize: 20 },
  tile: {
    backgroundColor: theme.panel,
    borderRadius: 14,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.15)",
  },
  tileText: { color: theme.text, fontWeight: "700", fontSize: 16 },
  tileChev: { color: theme.textDim, fontSize: 22 },
});
