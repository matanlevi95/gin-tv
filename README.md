# ג׳ין TV — Hebrew Gin Rummy (TV + Android)

A 2-player Gin Rummy game where the TV is the shared table and each Android phone is a private hand controller. Hebrew-first, RTL throughout.

**Architecture:** there is no game server of ours. The TV browser is the authority — it holds room state, validates actions, and broadcasts results. Supabase Realtime is used as a free, no-backend message bus. Phones and TV exchange messages over Supabase broadcast channels.

- **TV** (`apps/tv`): React + Vite. Persists a stable 4-char TV code in localStorage, shows a single QR + that code, runs the engine, broadcasts state.
- **Mobile** (`apps/mobile`): Expo React Native (Android). Each phone has a profile with a list of saved TVs and a green/red online indicator. Scan QR or type the code; once joined, optionally save the TV with a label.
- **Shared** (`shared`): Types + Gin Rummy engine (deck, melds, deadwood, scoring) + the realtime protocol (`RoomHost`).

Free, no card, no server. The TV is the brain.

---

## Live URLs

| What | URL |
|---|---|
| TV web app | https://gin-tv.vercel.app |
| Android APK direct download | https://gin-tv.vercel.app/apk |
| Android APK (GitHub Releases) | https://github.com/matanlevi95/gin-tv/releases/download/v0.1.0/gin-tv.apk |
| Source | https://github.com/matanlevi95/gin-tv |

The TV URL is your bookmark/PWA target. The APK URL is what you paste into Downloader-style apps on an Android TV, or what you send via WhatsApp.

---

## How to play

1. Open https://gin-tv.vercel.app on the TV (browser or PWA via "Add to Home Screen").
2. The TV shows a single QR and a 4-letter code (e.g., `79WN`). The code is **stable per TV** — it doesn't change between sessions.
3. On each phone: open the app → **התחבר לטלוויזיה** → scan QR (or tap "הקלידו קוד ידני" and type the 4 letters).
4. On first connect, the app offers to save the TV with a label like "סלון". Next time you open the app, you'll see "סלון 🟢" if the TV is on, "סלון 🔴" if it isn't, and you can connect with one tap.
5. Each player taps **מוכן**. When both ready: 3-2-1 → round begins.
6. Phone gameplay: take a card (deck or discard) → select one to discard → tap **זרוק קלף**. When eligible, **נקישה** (deadwood ≤ 10) or **ג׳ין** (deadwood = 0) light up.
7. Round end is revealed on the TV. Tap **מוכן לסיבוב נוסף** to continue. First to 100 points wins.

---

## Game rules implemented

Standard 2-player Gin Rummy, cross-checked against the [Pagat reference](https://www.pagat.com/rummy/ginrummy.html):

- 52-card deck (no jokers), 10 cards per player, one face-up discard.
- Turn: draw (deck or discard) → discard.
- Set = 3–4 same rank. Run = 3+ consecutive same suit. **No K-A wrap.**
- Card values: A=1, 2–10 face value, J/Q/K = 10.
- **Knock**: legal when deadwood ≤ 10 after the draw.
- **Gin**: deadwood = 0 → +25 bonus, no lay-offs.
- **Lay-offs**: only on knock (not gin). Defender adds deadwood cards onto knocker's melds. Lay-offs can't land on knocker's deadwood and the knocker can't lay off.
- **Undercut**: defender's deadwood (after lay-offs) ≤ knocker's → defender wins (difference + 25 bonus).
- **No re-discard**: a card just taken from the discard pile may not be put back on the same turn.
- **Deck-exhaustion cancellation**: when the deck is reduced to 2 cards after a discard (and no knock/gin), the round is cancelled and re-dealt with no score change.
- Match target: **100** points.

Engine has 58 unit tests; the live realtime layer has 8 end-to-end tests (against the real Supabase project).

---

## Connection / privacy model

- Each TV has a stable 4-char code stored in its browser localStorage.
- Phones scan the TV's single QR — that QR encodes the TV code + the project's Supabase URL + anon key.
- Each phone generates a **fresh 32-char private token** on every connect. The phone subscribes only to `gin:<code>:player:<token>`. Because no one else knows the token, no one else can subscribe to that channel — that's the privacy boundary.
- The phone sends a "hello" with `{ playerId, privateToken }`. The TV uses the playerId as the persistent seat key (so the same player gets the same seat on reconnect) and the privateToken as the address to send their hand updates to.
- Up to 2 distinct `playerId`s per TV. A 3rd is rejected with "room full".
- TV broadcasts a heartbeat every 4 seconds. Phones use this to display the online/offline dot on saved TVs.

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
npm install
npm --workspace shared run build

# TV creds (the same Supabase project the apps already point to):
cp apps/tv/.env.example apps/tv/.env.local
# fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from supabase.com → Project Settings → API
```

Mobile credentials are baked into `apps/mobile/app.json` under `expo.extra.supabaseUrl`/`supabaseAnonKey`. The QR a phone scans overrides these per-connection.

## Running locally

```bash
# Terminal 1 — TV
npm --workspace @gin-tv/tv run dev
# -> http://localhost:5173

# Terminal 2 — Mobile (Expo)
npm --workspace @gin-tv/mobile run start
# scan with Expo Go (Android) or 'a' to open emulator
```

No server to start. Both clients connect directly to Supabase Realtime.

## Testing

```bash
# Engine unit tests (58/58)
npm --workspace shared run test

# Live e2e against Supabase Realtime (8/8)
node /tmp/e2e-v2.mjs   # script lives in the repo's test-vault if you need it
```

## Build APK locally (no EAS account required)

```bash
cd apps/mobile
JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
ANDROID_HOME=$HOME/Library/Android/sdk \
npx expo prebuild --platform android --no-install --clean

# one-time: generate a release keystore (already in repo: android/app/gin-tv.keystore)
# build:
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
ANDROID_HOME=$HOME/Library/Android/sdk \
PATH=$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools \
./gradlew assembleRelease --no-daemon
# output: app/build/outputs/apk/release/app-release.apk (~85MB)
```

## Deploy

The architecture has just two cloud pieces:

| Piece | Where | Cost |
|---|---|---|
| TV (`apps/tv`) | Vercel Hobby | Free, no card |
| Realtime + Auth | Supabase Free | Free, no card |
| Mobile APK | Local Gradle → WhatsApp / GitHub Releases | Free |

### TV → Vercel

```bash
vercel link --yes --project gin-tv
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel deploy --prod
```

### Samsung Tizen TV (optional)

The TV app also packages as a Tizen `.wgt` (file at the repo root: `gin-tv.wgt`). Installing it requires:

1. Tizen Studio (free, 1GB+).
2. A Samsung developer certificate (free, generated in Tizen Studio's Certificate Manager).
3. Developer Mode enabled on the TV.
4. Sign the .wgt with your cert and install via Tizen Studio's Device Manager.

The Downloader app on Tizen cannot install .wgt files — Samsung requires their official sideload path.

## Known limitations / next steps

- **No login** — profiles + match history live in `AsyncStorage` per device. Supabase Auth (email + password) planned next.
- **No reconnect timeout** — a disconnected player stalls the turn. Manual reconnect via the saved-TVs list works.
- **No sounds** — silent for now.
- **First-turn upcard variant** — we skip the "non-dealer chooses upcard first, then dealer" mechanic from the Pagat ruleset. Most casual players don't notice.
