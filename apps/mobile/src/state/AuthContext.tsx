import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True once we've checked the persisted session at least once. */
  initialized: boolean;
  /** True when guest mode is explicitly chosen (no auth, profile lives only on this device). */
  isGuest: boolean;
  enterGuestMode: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_GUEST = "ginTv:guestMode";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Restore guest preference
      const g = await AsyncStorage.getItem(STORAGE_GUEST);
      if (g === "1" && mounted) setIsGuest(true);
      // Restore session
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setInitialized(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const enterGuestMode = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_GUEST, "1");
    setIsGuest(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return { ok: false, error: humanError(error.message) };
    await AsyncStorage.removeItem(STORAGE_GUEST);
    setIsGuest(false);
    return { ok: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setLoading(false);
    if (error) return { ok: false, error: humanError(error.message) };
    if (!data.session) {
      // Email confirmation required by the project.
      return { ok: true, error: "נשלח אימייל אימות — אשר ואז התחבר" };
    }
    await AsyncStorage.removeItem(STORAGE_GUEST);
    setIsGuest(false);
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, session, loading, initialized, isGuest, enterGuestMode, signIn, signUp, signOut }),
    [user, session, loading, initialized, isGuest, enterGuestMode, signIn, signUp, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}

function humanError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "אימייל או סיסמה לא נכונים";
  if (m.includes("already registered") || m.includes("already exists")) return "האימייל כבר רשום";
  if (m.includes("password")) return "סיסמה קצרה מדי (לפחות 6 תווים)";
  if (m.includes("network") || m.includes("fetch")) return "אין חיבור לאינטרנט";
  if (m.includes("rate")) return "יותר מדי ניסיונות, נסה עוד דקה";
  return msg;
}
