import React, { useEffect } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import type { Card as CardT, Rank, Suit } from "@gin-tv/shared";
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

function CenterPips({
  rank,
  suit,
  color,
  w,
  h,
  size,
}: {
  rank: Rank;
  suit: Suit;
  color: string;
  w: number;
  h: number;
  size: "sm" | "md" | "lg";
}) {
  if (rank === "A" || rank === "J" || rank === "Q" || rank === "K") {
    const big = size === "lg" ? 56 : size === "md" ? 40 : 24;
    return (
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SuitIcon suit={suit} size={big} color={color} />
      </View>
    );
  }
  const n = parseInt(rank, 10);
  const layouts: Record<number, [number, number][]> = {
    2: [[0.5, 0.25], [0.5, 0.75]],
    3: [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
    4: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.75], [0.7, 0.75]],
    5: [[0.3, 0.25], [0.7, 0.25], [0.5, 0.5], [0.3, 0.75], [0.7, 0.75]],
    6: [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    7: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    8: [[0.3, 0.2], [0.7, 0.2], [0.5, 0.32], [0.3, 0.5], [0.7, 0.5], [0.5, 0.68], [0.3, 0.8], [0.7, 0.8]],
    9: [[0.3, 0.18], [0.7, 0.18], [0.3, 0.38], [0.7, 0.38], [0.5, 0.5], [0.3, 0.62], [0.7, 0.62], [0.3, 0.82], [0.7, 0.82]],
    10: [[0.3, 0.15], [0.7, 0.15], [0.5, 0.24], [0.3, 0.32], [0.7, 0.32], [0.3, 0.68], [0.7, 0.68], [0.5, 0.76], [0.3, 0.85], [0.7, 0.85]],
  };
  const positions = layouts[n] || [];
  const pip = size === "lg" ? 16 : size === "md" ? 12 : 8;
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: w,
        height: h,
      }}
    >
      {positions.map(([x, y], i) => {
        const flipped = y > 0.5;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x * w - pip / 2,
              top: y * h - pip / 2,
              transform: flipped ? [{ rotate: "180deg" }] : [],
            }}
          >
            <SuitIcon suit={suit} size={pip} color={color} />
          </View>
        );
      })}
    </View>
  );
}

interface Props {
  card: CardT;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  style?: ViewStyle;
  faded?: boolean;
}

export function CardView({ card, size = "md", selected, style, faded }: Props) {
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

  return (
    <Animated.View
      style={[
        styles.card,
        { width: dims.w, height: dims.h, borderRadius: dims.r },
        selected && styles.selected,
        faded && { opacity: 0.5 },
        animatedStyle,
        style,
      ]}
    >
      <View style={styles.cornerTop}>
        <Text style={[styles.rank, { color, fontSize: dims.cornerFs }]}>
          {card.rank}
        </Text>
        <SuitIcon suit={card.suit} size={dims.cornerFs - 2} color={color} />
      </View>
      <CenterPips rank={card.rank} suit={card.suit} color={color} w={dims.w} h={dims.h} size={size} />
      <View style={styles.cornerBot}>
        <Text style={[styles.rank, { color, fontSize: dims.cornerFs }]}>
          {card.rank}
        </Text>
        <SuitIcon suit={card.suit} size={dims.cornerFs - 2} color={color} />
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
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
        <SuitIcon suit="C" size={dims.centerFs} color={theme.gold} />
      </View>
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
    shadowColor: theme.gold,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
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
});
