import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HE } from "@gin-tv/shared";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Lobby">;

export function LobbyScreen({ navigation, route }: Props) {
  const { publicState, playerId, ready } = useGame();

  useEffect(() => {
    // If the round becomes playing -> jump to Hand
    if (publicState && publicState.status === "playing") {
      navigation.replace("Hand");
    }
  }, [publicState, navigation]);

  if (!publicState) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.title}>{HE.loading}</Text>
      </SafeAreaView>
    );
  }

  const me = publicState.players.find((p) => p.id === playerId);
  const opp = publicState.players.find((p) => p.id !== playerId);
  const iAmReady = !!me?.ready;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>{HE.roomCode}</Text>
        <Text style={styles.code}>{publicState.roomCode}</Text>
      </View>

      <View style={styles.playersBox}>
        <PlayerCard
          name={me?.name ?? HE.you}
          ready={!!me?.ready}
          isMe
        />
        <PlayerCard
          name={opp?.name ?? HE.waitingOpponent}
          ready={!!opp?.ready}
          waiting={!opp}
        />
      </View>

      <Text style={styles.helper}>
        {publicState.players.length < 2
          ? `${HE.waitingOpponent}…`
          : iAmReady
          ? "מחכים שגם היריב יהיה מוכן"
          : "לחץ מוכן כשאתה רוצה להתחיל"}
      </Text>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={[styles.readyBtn, iAmReady && styles.readyBtnOn]}
        activeOpacity={0.85}
        onPress={() => ready(!iAmReady)}
      >
        <Text style={[styles.readyBtnText, iAmReady && { color: "#0a2a1f" }]}>
          {iAmReady ? "ביטול" : HE.ready}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function PlayerCard({
  name,
  ready,
  isMe,
  waiting,
}: {
  name: string;
  ready: boolean;
  isMe?: boolean;
  waiting?: boolean;
}) {
  return (
    <View
      style={[
        styles.playerCard,
        ready && styles.playerCardReady,
        waiting && { opacity: 0.5 },
      ]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name?.[0] ?? "?"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.playerName}>
          {name} {isMe ? "· אני" : ""}
        </Text>
        <Text style={[styles.statusText, { color: ready ? theme.accent : theme.textDim }]}>
          {waiting ? "מחכה לחיבור" : ready ? HE.ready : HE.notReady}
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: ready ? theme.accent : "#6b6b6b" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 18 },
  title: { color: theme.text, fontSize: 22, marginTop: 36, textAlign: "center" },
  codeBox: { alignItems: "center", marginTop: 16, marginBottom: 22 },
  codeLabel: { color: theme.textDim, fontSize: 14 },
  code: {
    color: theme.goldSoft,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: 8,
    marginTop: 4,
  },
  playersBox: { gap: 12 },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.panel,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.2)",
  },
  playerCardReady: { borderColor: theme.accent },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "900", color: "#2a1a05", fontSize: 18 },
  playerName: { color: theme.text, fontSize: 16, fontWeight: "700" },
  statusText: { fontSize: 13, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  helper: { color: theme.textDim, textAlign: "center", marginTop: 20 },
  readyBtn: {
    backgroundColor: theme.panel,
    borderColor: theme.gold,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 8,
  },
  readyBtnOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  readyBtnText: { color: theme.gold, fontSize: 22, fontWeight: "900" },
});
