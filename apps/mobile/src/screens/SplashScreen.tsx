import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { theme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace("Home"), 900);
    return () => clearTimeout(t);
  }, [navigation]);
  return (
    <View style={styles.root}>
      <Text style={styles.titleGold}>משחקי</Text>
      <Text style={styles.titleCream}>TV</Text>
      <Text style={styles.sub}>טוען…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  titleGold: { fontSize: 64, fontWeight: "900", color: theme.gold },
  titleCream: { fontSize: 56, fontWeight: "900", color: theme.text, marginTop: -8 },
  sub: { color: theme.textDim, marginTop: 28, fontSize: 16 },
});
