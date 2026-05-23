import { createClient } from "@supabase/supabase-js";

const URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
const ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY as string;

if (!URL || !ANON_KEY) {
  // Don't crash — surface a clear message during dev.
  console.error(
    "[gin-tv] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy apps/tv/.env.example to apps/tv/.env.local."
  );
}

export const supabase = createClient(URL ?? "", ANON_KEY ?? "", {
  realtime: { params: { eventsPerSecond: 20 } },
});

export const SUPABASE_URL_PUBLIC = URL ?? "";
export const SUPABASE_ANON_PUBLIC = ANON_KEY ?? "";
