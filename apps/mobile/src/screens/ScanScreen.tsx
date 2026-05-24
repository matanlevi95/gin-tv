import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HE, decodeJoinUrl, isValidRoomCode } from "@gin-tv/shared";
import Constants from "expo-constants";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const { joinRoom, saveTV } = useGame();
  const [scanned, setScanned] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const tryJoin = useCallback(
    async (params: { roomCode: string; supabaseUrl?: string; supabaseAnonKey?: string }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      const res = await joinRoom(params);
      setBusy(false);
      inFlight.current = false;
      if (res.ok) {
        // Navigate to the lobby immediately — UX cannot block on a prompt because
        // Alert.prompt is iOS-only and silently does nothing on Android.
        // Save the TV in the background with the room code as the default label;
        // user can rename it later from the Profile screen.
        saveTV({
          code: params.roomCode,
          label: `טלוויזיה ${params.roomCode}`,
          supabaseUrl: params.supabaseUrl || extra.supabaseUrl || "",
          supabaseAnonKey: params.supabaseAnonKey || extra.supabaseAnonKey || "",
          lastConnectedAt: Date.now(),
        }).catch(() => {});
        navigation.replace("Lobby", { roomCode: params.roomCode });
      } else {
        Alert.alert("שגיאה", res.error || HE.errorGeneric);
        setScanned(false);
      }
    },
    [joinRoom, navigation, saveTV]
  );

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);
      const parsed = decodeJoinUrl(data);
      if (!parsed) {
        Alert.alert("קוד לא תקין", "ה-QR לא נראה כקוד חיבור של משחקי TV");
        setTimeout(() => setScanned(false), 1500);
        return;
      }
      tryJoin({
        roomCode: parsed.room,
        supabaseUrl: parsed.supabaseUrl,
        supabaseAnonKey: parsed.supabaseAnonKey,
      });
    },
    [scanned, tryJoin]
  );

  const onManualConnect = () => {
    const code = manualCode.toUpperCase();
    if (!isValidRoomCode(code)) {
      Alert.alert("קוד לא תקין", "קוד חדר הוא 4 תווים (אותיות באנגלית ומספרים)");
      return;
    }
    tryJoin({ roomCode: code });
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      {!showManual ? (
        <>
          <View style={styles.cameraBox}>
            {permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={onScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              />
            ) : (
              <View style={styles.permWrap}>
                <Text style={styles.permText}>צריך הרשאה למצלמה כדי לסרוק קוד QR</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                  <Text style={styles.primaryBtnText}>תן הרשאה</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.scanFrame} pointerEvents="none" />
            {busy && (
              <View style={styles.busyOverlay}>
                <ActivityIndicator size="large" color={theme.gold} />
                <Text style={{ color: theme.text, marginTop: 10 }}>{HE.connecting}</Text>
              </View>
            )}
          </View>
          <Text style={styles.helper}>סרקו את ה-QR שעל מסך הטלוויזיה</Text>
          <TouchableOpacity
            style={styles.manualLink}
            onPress={() => setShowManual(true)}
          >
            <Text style={styles.manualLinkText}>או הקלידו קוד ידני</Text>
          </TouchableOpacity>
        </>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.manualBox}>
            <Text style={styles.manualTitle}>{HE.enterCode}</Text>
            <Text style={styles.manualSubtitle}>הקוד מופיע מתחת ל-QR על הטלוויזיה</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="characters"
              maxLength={4}
              placeholder="ABCD"
              placeholderTextColor={theme.textDim}
              value={manualCode}
              onChangeText={(t) => setManualCode(t.toUpperCase())}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 14 }, !isValidRoomCode(manualCode) && { opacity: 0.4 }]}
              disabled={!isValidRoomCode(manualCode) || busy}
              onPress={onManualConnect}
            >
              {busy ? (
                <ActivityIndicator color="#2a1a05" />
              ) : (
                <Text style={styles.primaryBtnText}>{HE.manualConnect}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => setShowManual(false)}
            >
              <Text style={styles.manualLinkText}>חזרה לסריקה</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  cameraBox: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  scanFrame: {
    position: "absolute",
    // Square — sized to ~70% of the narrower viewport dimension, centered.
    width: Math.min(Dimensions.get("window").width, 600) * 0.7,
    height: Math.min(Dimensions.get("window").width, 600) * 0.7,
    top: "50%",
    left: "50%",
    marginTop: -(Math.min(Dimensions.get("window").width, 600) * 0.35),
    marginLeft: -(Math.min(Dimensions.get("window").width, 600) * 0.35),
    borderWidth: 3,
    borderColor: theme.gold,
    borderRadius: 12,
  },
  permWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.panel,
    padding: 16,
  },
  permText: { color: theme.text, fontSize: 16, marginBottom: 14, textAlign: "center" },
  busyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  helper: { color: theme.textDim, textAlign: "center", marginTop: 14, fontSize: 16 },
  manualLink: { padding: 14, alignItems: "center" },
  manualLinkText: { color: theme.gold, fontSize: 16, fontWeight: "700" },
  manualBox: {
    flex: 1,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  manualTitle: { color: theme.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  manualSubtitle: { color: theme.textDim, fontSize: 14, marginBottom: 26 },
  input: {
    backgroundColor: theme.panel,
    color: theme.text,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 12,
    textAlign: "center",
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.gold,
    width: "85%",
  },
  primaryBtn: {
    backgroundColor: theme.gold,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#2a1a05", fontSize: 18, fontWeight: "900" },
  backLink: { padding: 14, marginTop: 12 },
});
