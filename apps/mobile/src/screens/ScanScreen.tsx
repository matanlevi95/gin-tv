import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HE, decodeJoinUrl } from "@gin-tv/shared";
import { theme } from "../theme";
import { useGame } from "../state/GameContext";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

export function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const { joinRoom } = useGame();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const tryJoin = useCallback(
    async (params: {
      roomCode: string;
      token: string;
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    }) => {
      const res = await joinRoom(params);
      if (res.ok) {
        navigation.replace("Lobby", { roomCode: params.roomCode });
      } else {
        Alert.alert("שגיאה", res.error || HE.errorGeneric);
        setScanned(false);
      }
    },
    [joinRoom, navigation]
  );

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);
      const parsed = decodeJoinUrl(data);
      if (!parsed) {
        Alert.alert("קוד לא תקין", "ה-QR לא נראה כקוד חיבור של ג׳ין TV");
        setTimeout(() => setScanned(false), 1500);
        return;
      }
      tryJoin({
        roomCode: parsed.room,
        token: parsed.token,
        supabaseUrl: parsed.supabaseUrl,
        supabaseAnonKey: parsed.supabaseAnonKey,
      });
    },
    [scanned, tryJoin]
  );

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
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
      </View>

      <Text style={styles.helper}>סרקו את ה-QR שמופיע על מסך הטלוויזיה</Text>
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
    top: 60,
    bottom: 60,
    left: 60,
    right: 60,
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
  helper: { color: theme.textDim, textAlign: "center", marginTop: 14, fontSize: 16 },
  primaryBtn: {
    backgroundColor: theme.gold,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#2a1a05", fontSize: 18, fontWeight: "800" },
});
