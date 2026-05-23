import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import type { Card as CardT, Suit } from "@gin-tv/shared";
import { theme } from "../theme";

const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_RED: Record<Suit, boolean> = { S: false, H: true, D: true, C: false };

interface Props {
  card: CardT;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  style?: ViewStyle;
  faded?: boolean;
}

export function CardView({ card, size = "md", selected, style, faded }: Props) {
  const red = SUIT_RED[card.suit];
  const dims = size === "lg" ? L : size === "sm" ? S : M;
  return (
    <View
      style={[
        styles.card,
        { width: dims.w, height: dims.h, borderRadius: dims.r },
        selected && styles.selected,
        faded && { opacity: 0.5 },
        style,
      ]}
    >
      <View style={styles.cornerTop}>
        <Text style={[styles.rank, { color: red ? theme.red : theme.black, fontSize: dims.cornerFs }]}>
          {card.rank}
        </Text>
        <Text style={[styles.pip, { color: red ? theme.red : theme.black, fontSize: dims.cornerFs - 2 }]}>
          {SUIT_GLYPH[card.suit]}
        </Text>
      </View>
      <Text
        style={[
          styles.centerGlyph,
          { color: red ? theme.red : theme.black, fontSize: dims.centerFs },
        ]}
      >
        {SUIT_GLYPH[card.suit]}
      </Text>
      <View style={styles.cornerBot}>
        <Text style={[styles.rank, { color: red ? theme.red : theme.black, fontSize: dims.cornerFs }]}>
          {card.rank}
        </Text>
        <Text style={[styles.pip, { color: red ? theme.red : theme.black, fontSize: dims.cornerFs - 2 }]}>
          {SUIT_GLYPH[card.suit]}
        </Text>
      </View>
    </View>
  );
}

export function CardBackView({ size = "md", style }: { size?: "sm" | "md" | "lg"; style?: ViewStyle }) {
  const dims = size === "lg" ? L : size === "sm" ? S : M;
  return (
    <View
      style={[
        styles.card,
        {
          width: dims.w,
          height: dims.h,
          borderRadius: dims.r,
          backgroundColor: "#163b30",
          borderColor: "#0c2a22",
        },
        style,
      ]}
    >
      <Text style={{ position: "absolute", alignSelf: "center", top: dims.h / 2 - dims.centerFs / 1.6, fontSize: dims.centerFs, color: theme.gold, opacity: 0.6 }}>
        ♣
      </Text>
    </View>
  );
}

const S = { w: 42, h: 60, r: 6, cornerFs: 12, centerFs: 22 };
const M = { w: 64, h: 92, r: 8, cornerFs: 16, centerFs: 32 };
const L = { w: 80, h: 116, r: 10, cornerFs: 20, centerFs: 42 };

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.cardFace,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    padding: 6,
    overflow: "hidden",
    position: "relative",
  },
  selected: {
    borderColor: theme.gold,
    borderWidth: 3,
    transform: [{ translateY: -16 }],
    shadowColor: theme.gold,
    shadowOpacity: 0.85,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  cornerTop: { position: "absolute", top: 4, right: 4, alignItems: "center" },
  cornerBot: {
    position: "absolute",
    bottom: 4,
    left: 4,
    alignItems: "center",
    transform: [{ rotate: "180deg" }],
  },
  rank: { fontWeight: "800" },
  pip: { fontWeight: "700" },
  centerGlyph: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    fontWeight: "700",
  },
});
