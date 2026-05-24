import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";
import { useAuth } from "../state/AuthContext";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const { signIn, signUp, enterGuestMode, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const onSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("חסר", "אימייל וסיסמה");
      return;
    }
    const res =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, displayName.trim() || "אורח");
    if (!res.ok) {
      Alert.alert("שגיאה", res.error || "אופס");
    } else if (res.error) {
      Alert.alert("הצלחה", res.error);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.titleGold}>משחקי</Text>
          <Text style={styles.titleCream}>TV</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === "signin" && styles.tabActive]}
              onPress={() => setMode("signin")}
            >
              <Text style={[styles.tabText, mode === "signin" && styles.tabTextActive]}>התחבר</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "signup" && styles.tabActive]}
              onPress={() => setMode("signup")}
            >
              <Text style={[styles.tabText, mode === "signup" && styles.tabTextActive]}>הרשמה</Text>
            </TouchableOpacity>
          </View>

          {mode === "signup" && (
            <>
              <Text style={styles.label}>שם</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                style={styles.input}
                placeholder="לדוגמה: ליאור"
                placeholderTextColor={theme.textDim}
              />
            </>
          )}

          <Text style={styles.label}>אימייל</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={theme.textDim}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>סיסמה</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="לפחות 6 תווים"
            placeholderTextColor={theme.textDim}
            secureTextEntry
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#2a1a05" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "signin" ? "התחבר" : "צור חשבון"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.guestBtn} onPress={enterGuestMode}>
          <Text style={styles.guestBtnText}>המשך כאורח (ללא חשבון)</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 18 },
  titleBlock: { alignItems: "center", marginTop: 30, marginBottom: 30 },
  titleGold: { color: theme.gold, fontSize: 48, fontWeight: "900" },
  titleCream: { color: theme.text, fontSize: 36, fontWeight: "900", marginTop: -6 },
  card: {
    backgroundColor: theme.panel,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.2)",
  },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, backgroundColor: theme.bgSoft },
  tabActive: { backgroundColor: theme.gold },
  tabText: { color: theme.textDim, fontWeight: "700" },
  tabTextActive: { color: "#2a1a05", fontWeight: "900" },
  label: { color: theme.textDim, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: theme.bgSoft,
    color: theme.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(212,168,91,0.15)",
  },
  primaryBtn: {
    backgroundColor: theme.gold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtnText: { color: "#2a1a05", fontSize: 18, fontWeight: "900" },
  guestBtn: { padding: 14, alignItems: "center" },
  guestBtnText: { color: theme.textDim, fontSize: 15, textDecorationLine: "underline" },
});
