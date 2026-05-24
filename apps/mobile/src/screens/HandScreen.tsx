/**
 * Router: pick the right per-game controller screen based on the room's
 * gameType. Keeps a single navigation route ("Hand") so the rest of the app
 * doesn't have to know about which game is being played.
 */
import React from "react";
import { Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useGame } from "../state/GameContext";
import { RootStackParamList } from "../../App";
import { theme } from "../theme";
import { HandScreen as GinHandScreen } from "./games/gin/HandScreen";
import { YanivHandScreen } from "./games/yaniv/HandScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Hand">;

export function HandScreen(props: Props) {
  const { publicState } = useGame();
  const gameType = (publicState as any)?.gameType;
  if (gameType === "yaniv") return <YanivHandScreen {...props} />;
  // Default: Gin (covers the legacy state shape without gameType).
  return <GinHandScreen {...props} />;
}
