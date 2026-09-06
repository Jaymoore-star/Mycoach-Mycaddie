# MyCoach / MyCaddie

**Dominus Golf · Elite Academy** — a native mobile app pairing a structured
90-day coaching program with an on-course AI caddie.

> Your personal AI coach with 36 years of top-10 instructor knowledge and an
> elite on-course caddie — all in one app. 90 days to score under 80.

---

## What the app does

### My Coach — the 90-day program

Six phases, greens to tee, fifteen days each:

| # | Phase | Days | Focus |
|---|---|---|---|
| 1 | Putting | 1–15 | The flat stick — 40% of all strokes |
| 2 | Short Game | 16–30 | Chipping, bunkers, flop shots |
| 3 | Pitching | 31–45 | Wedge distance control (≤120 yds) |
| 4 | Mid Irons | 46–60 | 5–9 iron accuracy and trajectory |
| 5 | Hybrids & Woods | 61–75 | Long-game consistency |
| 6 | Driver | 76–90 | Distance, accuracy, shot shape |

Each day generates a session from the drill curriculum — warm-up, three to five
drills with coaching cues and completion standards, corrective actions, cooldown
and a completion gate. Sessions are tailored to skill level and to the chosen
coach.

**Four coaches**, each teaching a different level of the system:

| Coach | Level | Specialism | Target |
|---|---|---|---|
| Que | 1 | Foundation & mechanics | Breaking 100 |
| Mason | 2 | Kinetic sequencing, P-positions | Breaking 90 |
| Sam | 3 | Scoring, course strategy, short game | Breaking 80 |
| Dom | 4 | Elite optimisation, tour mentorship | Scratch and under |

**Pacing.** One program day per calendar day, enforced server-side. Miss a day
and nothing is lost — the program simply takes longer than 90 calendar days.

### My Caddie — on the course

An 18-course library with full hole data: par, stroke index, yardages for three
tee boxes, plus green break direction, severity and danger zones.

Live club recommendations that account for distance to pin, lie, wind speed and
direction, elevation, pin position, green firmness, temperature and course
altitude — returning club and alternate, playing yardage with every adjustment
itemised, aim, landing target, layup advice, pre-shot cues and a green read.

Hole-by-hole scoring feeds a **WHS handicap index**: differential =
`(gross − course rating) × 113 / slope`, averaging the best N differentials
× 0.96, with a running trend.

### Screen status

| Screen | State |
|---|---|
| Landing / sign-in / sign-up | ✅ Built |
| Onboarding | ✅ Built |
| Home (dashboard) | ✅ Built |
| 90-Day Program | ✅ Built |
| My Caddie + round scoring | ✅ Built |
| Profile | ✅ Built |
| My Coach | ⬜ Placeholder — AI coaching chat |
| My Swing | ⬜ Placeholder — video capture + AI analysis |
| My Stats / Bag / Handicap / Analytics / Streak | ⬜ Routed, not yet built |
| Launch Monitor / How to Use | ⬜ Routed, not yet built |

See [PLAN.md](PLAN.md) for the full build order and remaining work.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, TypeScript |
| Navigation | expo-router (file-based, typed routes) |
| Backend | Convex — reactive queries, mutations, file storage |
| Auth | Convex Auth — email/password + Google OAuth |
| Styling | React Native `StyleSheet` with a shared token layer |
| Icons | lucide-react-native + react-native-svg |
| Fonts | Playfair Display via `@expo-google-fonts` |

**Design tokens** live in `src/constants/theme.ts` — brushed gold `#C5A059` on
deep charcoal, Playfair Display for display type, light and dark both supported
(the app follows the device setting).

---

## Getting started

### Prerequisites

- **Node.js 20+** (developed on 24.16.0)
- **Expo Go** on your phone — [iOS](https://apps.apple.com/app/expo-go/id982107779) ·
  [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
- Access to the **`mycoach-mycaddie`** Convex project — ask the project owner
  for an invite

### 1. Install

```bash
git clone https://github.com/Jaymoore-star/Mycoach-Mycaddie.git
cd Mycoach-Mycaddie/mobile
npm install
```

### 2. Connect your own Convex dev deployment

```bash
npx convex dev
```

First run logs you in, then asks which project to use — choose the existing
**mycoach-mycaddie** project. This creates `.env.local` with your personal dev
deployment URL and generates `convex/_generated/`.

**`.env.local` is deliberately not committed.** Every developer gets their own
dev deployment, so the file cannot be shared. The app throws a clear error on
startup if it is missing.

Leave this running — it watches `convex/` and pushes backend changes.

### 3. Run the app

In a second terminal:

```bash
cd mobile
npx expo start --tunnel
```

Scan the QR code with Expo Go.

> **Use `--tunnel`.** Many office and corporate Wi-Fi networks enable AP client
> isolation, which blocks phone-to-laptop connections — Metro runs fine but the
> phone can never reach it. Tunnel mode routes through a public relay and
> sidesteps the LAN entirely. Plain `npx expo start` is faster if your network
> allows direct connections.

If port 8081 is in use, an earlier Metro instance is still running — stop it
with `Ctrl+C` first.

---

## Environment variables

### Client (`mobile/.env.local`, generated, not committed)

| Variable | Purpose |
|---|---|
| `CONVEX_DEPLOYMENT` | Which deployment `npx convex dev` targets |
| `EXPO_PUBLIC_CONVEX_URL` | Convex client endpoint |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions endpoint |

### Server (set on the Convex deployment, never in the repo)

Set with `npx convex env set NAME value`:

| Variable | Purpose | Status |
|---|---|---|
| `JWT_PRIVATE_KEY` | Signs auth tokens | Generated by `npx @convex-dev/auth` |
| `JWKS` | Public keys for verification | Generated alongside the above |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Set |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Set |
| `OPENAI_API_KEY` | Coach feedback, swing analysis | Not yet needed (step 9) |

Cloning the repo alone is **not** enough to stand up a working backend — the
secrets live on the deployment. Ask the project owner for Convex access.

> Never commit a `client_secret_*.json` downloaded from Google Cloud Console.
> It is gitignored; the values belong in Convex env vars.

---

## Project structure

```
mobile/
├── app.json                 Expo config — scheme "mycoach", plugins
├── convex/                  Backend (deployed to Convex, not bundled)
│   ├── schema.ts            10 tables + Convex Auth tables
│   ├── auth.ts              Password + Google providers, OAuth redirect rules
│   ├── profiles.ts          Golfer profile, program-day advance
│   ├── sessions.ts          Training sessions, drill completion, 30-day stats
│   ├── rounds.ts            Round scoring, WHS handicap
│   ├── devTools.ts          Internal-only dev helpers (not client callable)
│   └── lib/                 Shared pure logic
│       ├── curriculum.ts    Drill library, coach cues, session generation
│       ├── caddie.ts        Club selection and yardage adjustments
│       ├── courses.ts       18-course library with hole and green data
│       └── strokesGained.ts Strokes-gained maths
└── src/
    ├── app/                 expo-router routes
    │   ├── _layout.tsx      Auth gating via Stack.Protected
    │   ├── index.tsx        Landing (signed out)
    │   ├── sign-in.tsx      Sign in / sign up
    │   ├── onboarding.tsx   5-step profile setup
    │   ├── (tabs)/          Home · My Coach · My Caddie · My Swing · Profile
    │   └── round/[id].tsx   Active round scoring
    ├── components/ui/       Screen, Card, Button, ThemedText, ChipRow
    ├── constants/           theme, golf domain values, coach roster
    ├── hooks/               Theme and OAuth hooks
    └── lib/                 Convex client, local-date helpers
```

### Data model

`golferProfiles` · `trainingSessions` · `shotLogs` · `skillsTests` ·
`roundScores` · `customCourses` · `swingVideos` · `launchSessions` ·
`launchShots` · `courseCache`, plus the Convex Auth tables (`users`,
`authAccounts`, `authSessions`, …).

---

## Scripts

Run from `mobile/`:

| Command | Purpose |
|---|---|
| `npx expo start --tunnel` | Dev server (use tunnel on restrictive Wi-Fi) |
| `npx convex dev` | Backend watcher — run alongside Expo |
| `npx tsc --noEmit` | Typecheck the app |
| `npx tsc --noEmit -p convex` | Typecheck the backend |
| `npx expo export --platform android` | Verify a production bundle builds |
| `npm run lint` | ESLint |

---

## Conventions worth knowing

**Dates are computed on the client.** Convex functions run in UTC and cannot
know the device's timezone, so the app sends its own local `YYYY-MM-DD`
(`src/lib/date.ts`) and the server validates the format. Never use
`toISOString().split('T')[0]` for a user-facing "today" — it silently rolls the
day over at the wrong local hour.

**Ownership is checked on every call.** `profileId` and `roundId` arrive from
the client, so each query and mutation verifies the record belongs to the
signed-in user. See `ownedProfile` in `convex/sessions.ts`.

**Gates are enforced server-side.** Disabled buttons are a convenience; the real
checks (session complete, one advance per day) live in the mutations so a
modified client cannot bypass them.

**Numbers avoid Playfair.** Its old-style figures draw zero short, so "0d"
reads as "od". Use `<ThemedText variant="stat">` for any numeric value.

---

## Before launch

`PLAN.md` carries a launch checklist. The headline items:

- Google's consent screen shows the raw Convex domain until the app passes
  **brand verification** — that needs a custom domain, a privacy policy and a
  review
- The OAuth app must be **published to Production**; while in Testing only
  listed test users can sign in and sessions expire after 7 days
- Production needs its **own Convex deployment and its own OAuth client**
