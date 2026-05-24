import React, { useEffect } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HE } from "@gin-tv/shared";
import { theme } from "../theme";
import { useGame, SavedTV } from "../state/GameContext";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const {
    profile,
    tvStatuses,
    startTvStatusPoll,
    stopTvStatusPoll,
    joinRoom,
    removeTV,
  } = useGame();

  useEffect(() => {
    startTvStatusPoll();
    return () => {
      // We DON'T stop on unmount — polling continues so status is fresh when we come back.
      // To stop, call from a settings screen or app foreground/background hooks.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.tvs.length]);

  const connectToTV = async (tv: SavedTV) => {
    const status = tvStatuses[tv.code];
    if (status === "offline") {
      Alert.alert("הטלוויזיה לא מחוברת", "ודא שהיא דלוקה ושהאפליקציה פתוחה עליה");
      return;
    }
    const res = await joinRoom({
      roomCode: tv.code,
      supabaseUrl: tv.supabaseUrl,
      supabaseAnonKey: tv.supabaseAnonKey,
    });
    if (res.ok) {
      navigation.navigate("Lobby", { roomCode: tv.code });
    } else {
      Alert.alert("שגיאה", res.error || HE.errorGeneric);
    }
  };

  const longPressRemove = (tv: SavedTV) => {
    Alert.alert(tv.label, "מה לעשות?", [
      { text: "ביטול", style: "cancel" },
      { text: "הסר מהרשימה", style: "destructive", onPress: () => removeTV(tv.code) },
    ]);
  };

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
            <Text style={styles.titleGold}>משחקי</Text>
            <Text style={styles.titleCream}>TV</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label={HE.totalWins} value={profile.totalWins} />
          <Stat label={HE.winStreak} value={profile.winStreak} />
          <Stat label={HE.gamesPlayed} value={profile.gamesPlayed} />
        </View>

        {/* Saved TVs section */}
        <Text style={styles.sectionTitle}>{HE.myTVs}</Text>

        {profile.tvs.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{HE.noSavedTvs}</Text>
            <Text style={styles.emptySub}>{HE.scanQrToBegin}</Text>
          </View>
        )}

        {profile.tvs.map((tv) => (
          <SavedTVRow
            key={tv.code}
            tv={tv}
            status={tvStatuses[tv.code] ?? "checking"}
            onConnect={connectToTV}
            onLongPress={longPressRemove}
          />
        ))}

        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Scan")}
        >
          <Text style={styles.primaryBtnText}>{HE.addTV} / {HE.joinTv}</Text>
        </TouchableOpacity>

        <View style={{ height: 18 }} />

        <Tile label={HE.myProfile} onPress={() => navigation.navigate("Profile")} />
        <Tile label={HE.achievements} onPress={() => navigation.navigate("Achievements")} />
        <Tile label={HE.matchHistory} onPress={() => navigation.navigate("History")} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SavedTVRow({
  tv,
  status,
  onConnect,
  onLongPress,
}: {
  tv: SavedTV;
  status: string;
  onConnect: (tv: SavedTV) => void;
  onLongPress: (tv: SavedTV) => void;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (status === "online") {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [status, pulse]);
  const dotStyle = useAnimatedStyle(() => {
    if (status !== "online") return {};
    return {
      transform: [{ scale: 1 + 0.4 * pulse.value }],
      opacity: 0.7 + 0.3 * pulse.value,
    };
  });
  return (
    <TouchableOpacity
      style={[styles.tvTile, status === "online" && styles.tvTileOnline, status === "offline" && styles.tvTileOffline]}
      activeOpacity={0.85}
      onPress={() => onConnect(tv)}
      onLongPress={() => onLongPress(tv)}
    >
      <View style={{ position: "relative", width: 14, height: 14 }}>
        <View style={[styles.tvDot, statusStyle(status)]} />
        {status === "online" && (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.accent,
              },
              dotStyle,
            ]}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tvLabel}>{tv.label}</Text>
        <Text style={styles.tvCode}>קוד: {tv.code}</Text>
      </View>
      <Text style={styles.tvStatusText}>
        {status === "online" ? HE.tvOnline : status === "offline" ? HE.tvOffline : "בודק…"}
      </Text>
    </TouchableOpacity>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case "online":
      return { backgroundColor: theme.accent };
    case "offline":
      return { backgroundColor: theme.danger };
    default:
      return { backgroundColor: "#888" };
  }
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
  sectionTitle: { color: theme.textDim, fontSize: 14, marginBottom: 10, marginTop: 4, fontWeight: "700" },
  emptyBox: {
    backgroundColor: theme.panel,
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.15)",
  },
  emptyText: { color: theme.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: theme.textDim, fontSize: 13, marginTop: 4 },
  tvTile: {
    backgroundColor: theme.panel,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.15)",
  },
  tvTileOnline: { borderColor: theme.accent },
  tvTileOffline: { borderColor: "rgba(200, 85, 61, 0.4)", opacity: 0.7 },
  tvDot: { width: 14, height: 14, borderRadius: 7 },
  tvLabel: { color: theme.text, fontSize: 17, fontWeight: "800" },
  tvCode: { color: theme.textDim, fontSize: 13, marginTop: 2, letterSpacing: 2 },
  tvStatusText: { color: theme.textDim, fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: theme.gold,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: theme.gold,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  primaryBtnText: { color: "#2a1a05", fontWeight: "900", fontSize: 18 },
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
