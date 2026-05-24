import React, { useEffect } from "react";
import { I18nManager, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import type { Card as CardT, Suit } from "@gin-tv/shared";
import { theme } from "../theme";

const SUIT_PATH: Record<Suit, string> = {
  S: "M16 2 C 22 10, 30 14, 30 22 C 30 27, 26 30, 22 30 C 19 30, 17 28, 16 26 C 15 28, 13 30, 10 30 C 6 30, 2 27, 2 22 C 2 14, 10 10, 16 2 Z M14 26 L 12 32 L 20 32 L 18 26 Z",
  H: "M16 30 C 16 30, 2 20, 2 11 C 2 6, 6 3, 10 3 C 13 3, 15 5, 16 8 C 17 5, 19 3, 22 3 C 26 3, 30 6, 30 11 C 30 20, 16 30, 16 30 Z",
  D: "M16 1 L 30 16 L 16 31 L 2 16 Z",
  C: "M16 2 C 12 2, 10 5, 10 8 C 10 10, 11 12, 13 13 C 9 13, 6 16, 6 20 C 6 24, 9 27, 13 27 C 15 27, 16 26, 16 26 C 16 26, 14 30, 12 32 L 20 32 C 18 30, 16 26, 16 26 C 16 26, 17 27, 19 27 C 23 27, 26 24, 26 20 C 26 16, 23 13, 19 13 C 21 12, 22 10, 22 8 C 22 5, 20 2, 16 2 Z",
};
const SUIT_RED: Record<Suit, boolean> = { S: false, H: true, D: true, C: false };

function SuitIcon({ suit, size, color }: { suit: Suit; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path d={SUIT_PATH[suit]} fill={color} />
    </Svg>
  );
}

interface Props {
  card: CardT;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  style?: ViewStyle;
  faded?: boolean;
  /** Visually highlight that this card is part of a meld (for in-hand grouping hints). */
  meldColor?: string;
}

export function CardView({ card, size = "md", selected, style, faded, meldColor }: Props) {
  const red = SUIT_RED[card.suit];
  const color = red ? theme.red : theme.black;
  const dims = size === "lg" ? L : size === "sm" ? S : M;

  const lift = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    lift.value = withSpring(selected ? -22 : 0, { damping: 14, stiffness: 220 });
    scale.value = withTiming(selected ? 1.06 : 1, { duration: 180 });
  }, [selected, lift, scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  // direction:"ltr" wrapper ensures the inner absolute positioning doesn't
  // mirror in the RTL global layout.
  return (
    <Animated.View
      style={[
        styles.card,
        { width: dims.w, height: dims.h, borderRadius: dims.r },
        selected && styles.selected,
        !!meldColor && { borderColor: meldColor, borderWidth: 2 },
        faded && { opacity: 0.5 },
        animatedStyle,
        style,
      ]}
    >
      <View style={ltrFill}>
        {/* Top-left: rank + suit */}
        <View style={styles.cornerTL}>
          <Text style={[styles.rank, { color, fontSize: dims.cornerRank }]}>{card.rank}</Text>
          <SuitIcon suit={card.suit} size={dims.cornerSuit} color={color} />
        </View>
        {/* Center: big suit */}
        <View style={styles.centerFill}>
          <SuitIcon suit={card.suit} size={dims.center} color={color} />
        </View>
        {/* Bottom-right: rank + suit, rotated 180 */}
        <View style={styles.cornerBR}>
          <Text style={[styles.rank, { color, fontSize: dims.cornerRank }]}>{card.rank}</Text>
          <SuitIcon suit={card.suit} size={dims.cornerSuit} color={color} />
        </View>
      </View>
    </Animated.View>
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
      <View style={styles.centerFill}>
        <SuitIcon suit="C" size={dims.center} color={theme.gold} />
      </View>
    </View>
  );
}

const S = { w: 42, h: 60, r: 6, cornerRank: 11, cornerSuit: 9, center: 22 };
const M = { w: 64, h: 92, r: 8, cornerRank: 16, cornerSuit: 13, center: 36 };
const L = { w: 80, h: 116, r: 10, cornerRank: 20, cornerSuit: 16, center: 48 };

const ltrFill: ViewStyle = {
  position: "absolute",
  top: 0,
  bottom: 0,
  // Use start/end which always map to LTR within this subtree.
  left: 0,
  right: 0,
  direction: "ltr",
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.cardFace,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
    overflow: "hidden",
    position: "relative",
    // Force LTR so internal layout coordinates aren't mirrored by RN's RTL flip.
    direction: "ltr",
  },
  // Top-left of the LTR card surface — universal playing-card corner.
  cornerTL: {
    position: "absolute",
    top: 3,
    left: 4,
    alignItems: "center",
  },
  // Bottom-right of the LTR card surface, rotated 180 so it reads upright when card is rotated.
  cornerBR: {
    position: "absolute",
    bottom: 3,
    right: 4,
    alignItems: "center",
    transform: [{ rotate: "180deg" }],
  },
  centerFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    borderColor: theme.gold,
    borderWidth: 3,
    shadowColor: theme.gold,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  rank: { fontWeight: "900", lineHeight: undefined },
});
