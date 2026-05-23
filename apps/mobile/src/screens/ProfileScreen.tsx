import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";

export function ProfileScreen() {
  const { profile, setProfile } = useGame();
  const [name, setName] = useState(profile.name);
  const [letter, setLetter] = useState(profile.avatarLetter);

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{letter || "?"}</Text>
      </View>
      <Text style={styles.label}>שם</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholder="שם השחקן"
        placeholderTextColor={theme.textDim}
      />
      <Text style={styles.label}>אות לאווטאר</Text>
      <TextInput
        value={letter}
        onChangeText={(t) => setLetter(t.slice(0, 1))}
        maxLength={1}
        style={styles.input}
        placeholder="א"
        placeholderTextColor={theme.textDim}
      />
      <TouchableOpacity
        style={styles.saveBtn}
        onPress={() =>
          setProfile({ ...profile, name: name || "אורח", avatarLetter: letter || "א" })
        }
      >
        <Text style={styles.saveText}>שמור</Text>
      </TouchableOpacity>

      <View style={styles.statsBox}>
        <StatRow label="סך ניצחונות" value={profile.totalWins} />
        <StatRow label="רצף ניצחונות" value={profile.winStreak} />
        <StatRow label="משחקים ששוחקו" value={profile.gamesPlayed} />
      </View>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 18 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.gold,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  avatarText: { fontSize: 36, fontWeight: "900", color: "#2a1a05" },
  label: { color: theme.textDim, marginTop: 18, marginBottom: 6 },
  input: {
    backgroundColor: theme.panel,
    color: theme.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 18,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.2)",
  },
  saveBtn: {
    backgroundColor: theme.gold,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    marginTop: 18,
  },
  saveText: { color: "#2a1a05", fontWeight: "900", fontSize: 18 },
  statsBox: {
    marginTop: 22,
    backgroundColor: theme.panel,
    borderRadius: 14,
    padding: 14,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  statLabel: { color: theme.textDim },
  statValue: { color: theme.text, fontWeight: "800" },
});
