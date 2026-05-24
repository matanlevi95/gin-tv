/**
 * Single shared Supabase client for the mobile app.
 * Uses AsyncStorage for session persistence (RN doesn't have localStorage).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const SUPABASE_URL = extra.supabaseUrl ?? "";
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
