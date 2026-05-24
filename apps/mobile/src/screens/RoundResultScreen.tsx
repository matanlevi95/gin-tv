/** Router for round-end screens by gameType. */
import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useGame } from "../state/GameContext";
import { RootStackParamList } from "../../App";
import { RoundResultScreen as GinRoundResult } from "./games/gin/RoundResultScreen";
import { YanivRoundResultScreen } from "./games/yaniv/RoundResultScreen";

type Props = NativeStackScreenProps<RootStackParamList, "RoundResult">;

export function RoundResultScreen(props: Props) {
  const { publicState } = useGame();
  const gameType = (publicState as any)?.gameType;
  if (gameType === "yaniv") return <YanivRoundResultScreen {...props} />;
  return <GinRoundResult {...props} />;
}
