import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { I18nManager, StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GameProvider } from "./src/state/GameContext";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { HandScreen } from "./src/screens/HandScreen";
import { RoundResultScreen } from "./src/screens/RoundResultScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { AchievementsScreen } from "./src/screens/AchievementsScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { SplashScreen } from "./src/screens/SplashScreen";

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Scan: undefined;
  Lobby: { roomCode: string };
  Hand: undefined;
  RoundResult: undefined;
  Profile: undefined;
  Achievements: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Force RTL on first launch.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0a2a1f" />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
              headerStyle: { backgroundColor: "#0a2a1f" },
              headerTintColor: "#f4ecd6",
              headerTitleStyle: { fontWeight: "700" },
              headerBackTitleVisible: false,
              contentStyle: { backgroundColor: "#0a2a1f" },
              animation: "fade",
            }}
          >
            <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Scan" component={ScanScreen} options={{ title: "סריקת קוד" }} />
            <Stack.Screen name="Lobby" component={LobbyScreen} options={{ title: "מחכים למשחק" }} />
            <Stack.Screen name="Hand" component={HandScreen} options={{ headerShown: false }} />
            <Stack.Screen name="RoundResult" component={RoundResultScreen} options={{ title: "סיום סיבוב" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "הפרופיל שלי" }} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: "הישגים" }} />
            <Stack.Screen name="History" component={HistoryScreen} options={{ title: "היסטוריית משחקים" }} />
          </Stack.Navigator>
        </NavigationContainer>
      </GameProvider>
    </SafeAreaProvider>
  );
}
