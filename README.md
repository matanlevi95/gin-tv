# ג׳ין TV — Hebrew Gin Rummy (TV + Android)

A 2-player Gin Rummy game where the TV is the shared table and each Android phone is a private hand/controller. Hebrew-first, RTL throughout.

**Architecture:** there is no game server of ours. The TV browser is the authority — it holds room state, validates actions, and broadcasts results. Supabase Realtime is used as a free, no-backend message bus. The phones and TV exchange messages over Supabase broadcast channels.

- **TV** (`apps/tv`): React + Vite. Generates the room code + 2 per-seat tokens, shows them as QR codes, runs the game engine, broadcasts state.
- **Mobile** (`apps/mobile`): Expo React Native (Android). QR scan → join → controller for one hand. Sends action intents over Supabase, receives state.
- **Shared** (`shared`): TypeScript types + Gin Rummy engine (deck, melds, deadwood, scoring) + the Realtime protocol (`RoomHost` used by TV). Single source of truth for game rules.

Free, no card, no server. The TV is the brain.

---

## Project layout

```
apps/
  tv/        # React + Vite TV app (game authority)
  mobile/    # Expo React Native Android app (controller)
shared/      # TS types + Gin Rummy engine + Realtime protocol
```

## Local setup

Prerequisites: Node 20+, npm 9+.

```bash
# from repo root
npm install
npm --workspace shared run build
```

Set Supabase credentials (project URL + anon key from supabase.com → Project Settings → API):

```bash
# TV (build-time env, Vite picks these up)
cp apps/tv/.env.example apps/tv/.env.local
# edit apps/tv/.env.local with your VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

For mobile, the same credentials are encoded into the QR by the TV — phones get them from the scan. For dev builds you can also bake defaults into `apps/mobile/app.json` → `expo.extra.supabaseUrl` / `expo.extra.supabaseAnonKey`.

## Running locally

```bash
# Terminal 1 — TV
npm --workspace @gin-tv/tv run dev
# -> http://localhost:5173

# Terminal 2 — Mobile (Expo)
npm --workspace @gin-tv/mobile run start
# scan with Expo Go (Android) or press 'a' to open emulator
```

There is no server to start. The TV connects directly to Supabase Realtime. The phones connect directly to Supabase Realtime. They communicate via broadcast channels, never through a backend of yours.

## How to play

1. Open the TV app on your TV's browser (or laptop / Smart TV browser).
2. The TV shows the title, two QR codes (one per player slot), and the 4-letter room code.
3. Each player opens the app on their phone → **התחבר לטלוויזיה** → scan one of the QRs.
4. The TV reveals which seat each player took (overlay on top of that QR).
5. Each player taps **מוכן** in the lobby.
6. When both are ready, the TV runs a 3-2-1 countdown and the round begins.
7. Phone: take a card (deck or discard) → select one to discard → tap **זרוק קלף**.
8. When eligible, **נקישה** (deadwood ≤ 10) or **ג׳ין** (deadwood = 0) light up.
9. The TV reveals the round on round end. Tap **מוכן לסיבוב נוסף** to continue.
10. First to **100** points wins the match.

## Testing the engine

```bash
# 50 unit checks of the game engine
cd shared && npm test

# Full e2e test against the live Supabase project (simulates TV + 2 phones)
node /tmp/test-supabase-e2e.mjs  # script in the repo's test-vault
```

## Deploy

The architecture has just two cloud pieces:

| Piece | Where | Cost |
|---|---|---|
| TV (`apps/tv`) | Vercel Hobby | Free, no card |
| Realtime + Auth | Supabase Free | Free, no card |
| Mobile APK | EAS Build → WhatsApp to your phone | Free (limited monthly builds) |

### TV → Vercel

```bash
npm install -g vercel
vercel login
# from repo root:
vercel link          # personal scope (skip team prompts)
vercel env add VITE_SUPABASE_URL production       # paste your Supabase URL
vercel env add VITE_SUPABASE_ANON_KEY production  # paste your anon key
vercel deploy --prod
# -> https://your-tv.vercel.app
```

The TV is fully static after build — no backend needed. Vercel free covers 100GB/month bandwidth, more than enough.

### Mobile APK → WhatsApp

```bash
npm install -g eas-cli
cd apps/mobile
eas login
# (edit app.json -> expo.extra.supabaseUrl / supabaseAnonKey if you haven't already)
eas build -p android --profile preview
```

EAS returns a download URL like `https://expo.dev/artifacts/.../app.apk`. Open it in your browser, download the .apk, attach to WhatsApp → send to self → install on phone.

## Game rules implemented

Standard 2-player Gin Rummy:

- 52-card deck (no jokers), 10 cards per player, one face-up discard.
- Turn: draw (deck or discard) → discard.
- Set = 3–4 same rank. Run = 3+ consecutive same suit (no Ace-K wrap).
- Card values: A=1, 2–10 = face, J/Q/K = 10.
- Deadwood = best non-overlapping meld arrangement (branch-and-bound).
- Knock: legal when deadwood ≤ 10 after the draw.
- Gin: deadwood = 0; awards +25 bonus, no lay-offs.
- Lay-offs on knock (not gin).
- Undercut: opponent deadwood (after lay-offs) ≤ knocker deadwood → opponent wins difference + 25.
- Match target: 100 points.

## Realtime / privacy model

Each room has:
- **Public channel** `gin:<code>:room` — TV broadcasts state, phones broadcast actions.
- **Two private channels** `gin:<code>:player:<token>` — TV sends each player's private hand only to that player's channel.

Each per-seat token is a 32-char secret generated by the TV and encoded into one of the two QRs. The phone that scans QR-A subscribes to player-A's private channel; phone B subscribes to B's. Without the token (which only the QR contains) you cannot subscribe to someone else's hand — Supabase Realtime channel names act as the access key.

The TV is the **only** authority that processes actions. Phones send intents; the TV runs the shared engine and validates. Privacy of hands is enforced by Supabase channel access, not by trust in the phone.

## Future work

- **Supabase Auth (email + password)** — persistent profile/stats across reinstalls.
- **Google sign-in** — second auth provider, planned after email/password is stable.
- **Animations** — card flip on deal/discard, score count-up.
- **Sounds** — free SFX via `expo-av`.
- **Reconnect timeout** — kick a disconnected player after 60s and offer surrender.
