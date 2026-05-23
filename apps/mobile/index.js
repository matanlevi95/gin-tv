// Polyfill globals BEFORE any other module loads. supabase-js relies on URL /
// URLSearchParams which don't exist in Hermes by default.
import "react-native-url-polyfill/auto";

import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
