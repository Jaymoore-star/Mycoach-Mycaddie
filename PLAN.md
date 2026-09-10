# MyCoach / MyCaddie — Mobile Rebuild Plan

Rebuilding the Hercules web app as a standalone native mobile app.
All infrastructure is set up fresh and independent of Hercules.

## Workspace layout

| Path | Purpose |
|---|---|
| `reference/` | Hercules export. **Read-only.** Source of truth for behaviour and design. |
| `mobile/` | The new Expo / React Native app. All new work goes here. |
| `app.tar.gz` | Original archive, kept as a backup. |

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, TypeScript |
| Navigation | expo-router (file-based) |
| Backend | Convex (new project, own account) |
| Auth | Convex Auth — replaces `@usehercules/auth` |
| AI | OpenAI (own API key) — coach feedback, swing analysis |

## Design system (from `reference/src/index.css`)

- Brand: Dominus Golf — deep charcoal + brushed gold `#C5A059`
- Accent / primary: `oklch(0.68 0.1 68)` ≈ `#C5A059`
- Display font: Playfair Display (serif)
- Radius: `0.4rem` base
- Dark mode background: `oklch(0.13 0.01 60)`

## Navigation

Bottom tabs (5), taken from `reference/src/components/layout/AppLayout.tsx`:

`Home` · `My Coach` · `My Caddie` · `My Swing` · `Profile`

Secondary screens, reached from Profile:
`My Stats` · `My Bag` · `My Handicap` · `My Analytics` · `My Streak` ·
`90-Day Program` · `Launch Monitor` · `How to Use`

## Data model — 10 Convex tables

Ports over essentially unchanged from `reference/convex/schema.ts`:

`users` · `golferProfiles` · `trainingSessions` · `shotLogs` · `skillsTests` ·
`roundScores` · `customCourses` · `swingVideos` · `launchSessions` ·
`launchShots` · `courseCache`

## Scope

| Part | Size | Portability |
|---|---|---|
| Convex backend | ~3,800 lines | High — server code, mostly copy + adapt auth |
| Frontend pages | ~11,800 lines | Low — must be rewritten for React Native |

Largest screens: `caddie` (3,281), `coach` (1,153), `swing capture` (971),
`stats` (870), `profile` (810).

## Resume here

**Last worked: 10 September 2026. Steps 1–7 of 10 complete; every bug found in
the audit is fixed. `npm run verify` and both bundles pass.**

### Start the app

```bash
cd mobile
npx convex dev                 # terminal 1 — backend watcher
npx expo start --tunnel        # terminal 2 — must use --tunnel on this Wi-Fi
```

`--tunnel` is not optional on the "LQ Admin" network: it runs AP client
isolation, so the phone cannot reach Metro over the LAN. If port 8081 is busy,
an old Metro is still running — `Ctrl+C` it first.

### Next up

Every screen is built. No placeholders remain in the app. What's left:

1. **OpenAI API key** — unblocks the two "coming next" cards: conversational
   coaching on My Coach, and automatic swing analysis on My Swing. Set it with
   `npx convex env set OPENAI_API_KEY ...`, then port `analyzeSwing` from
   `reference/convex/swingVideos.ts` and the coach chat from
   `reference/src/pages/coach/page.tsx`.
2. **Skills tests** — `reference/convex/skillTests.ts` and
   `reference/convex/lib/skillTests.ts` are not ported. The phase gates in the
   90-Day Program currently rely on drill completion alone.
3. **Step 10, the 3D swing visualiser** — `@react-three/fiber` on `expo-gl`.
   Highest risk, lowest value; everything ships without it.
4. **Real course data** — see the launch checklist.
5. **Convex function tests** — `convex-test` to mock auth and the database.
   The pure logic in `convex/lib` is covered (219 tests); the functions are not.

Charts are drawn with `react-native-svg` in `src/components/ui/chart.tsx`
(`Sparkline`, `BarRow`, `CalendarHeat`, `HeroStat`) — single-series, one hue,
direct labels. No chart library was needed.

### Rules that must not be broken

1. **Client code may only import from `convex/lib/*` and `convex/_generated/api`.**
   Importing a Convex *function* module (`convex/clubs.ts`, etc.) pulls
   `@convex-dev/auth/server` → `jose` → `node:buffer` into the bundle and Metro
   fails to resolve it. Shared constants belong in `convex/lib/`.
2. **Never use `toISOString().split('T')[0]` for a user-facing date.** That is
   UTC. The client sends its own local date via `localDate()` in
   `src/lib/date.ts`, and the server validates the format.
3. **Check ownership in every query and mutation.** Ids arrive from the client.
   Follow the `ownedProfile` helper pattern.
4. **Enforce gates server-side.** Disabled buttons are a convenience only.
5. **Numbers use `<ThemedText variant="stat">`.** Playfair's old-style figures
   render zero short, so "0d" reads as "od".

### Verify before committing

```bash
npm run verify                          # typecheck (app + convex), lint, tests
npx expo export --platform android      # proves Metro can actually bundle it
```

The export step is separate on purpose: `tsc` passing does **not** prove the
bundle builds — that is how the `node:buffer` problem slipped through.

Tests live in `tests/` and cover the pure logic in `convex/lib` (handicap,
courses, caddie, curriculum) — 201 of them. Convex *functions* are still
untested; that needs `convex-test` to mock auth and the database.

### Fixed on 10 September 2026

- **Handicap** rewritten to WHS Rule 5.2a in `convex/lib/handicap.ts`. The old
  table was wrong for records of 10-19 rounds, applied the retired 0.96 USGA
  multiplier, and skipped the short-record adjustments.
- **My Bag** now reads `launchShots` as well as `shotLogs`, so Launch Monitor
  sessions actually reach the bag. The UI claimed this before it was true.
- **Onboarding** sets the coach from the chosen skill level. Each coach's
  drills are a single difficulty tier, so a mismatched pair silently delivered
  the wrong drills; a warning now shows if you override it.
- **Course data** repaired where self-contradictory (see the launch checklist).
- **Duplicated constants** (`PHASE_DAY_START`, `PROGRAM_DAYS`, phase labels)
  collapsed into `convex/lib/program.ts` and the curriculum.
- **Lint** installed and clean; a `useState` sitting after an early return in
  `program.tsx` would have crashed on profile load.

### Bugs fixed here that are still live in the Hercules app

Worth fixing there too if anyone is using it:

- `convex/lib/caddie.ts` negates `elevAdj` and `pinAdj`, inverting elevation
  and pin-position advice — it tells golfers to club **down** hitting uphill. A
  20-yard elevation change produces a 40-yard error. Fix: drop the two `-`
  signs.
- Dates computed in UTC roll the day over at the wrong local hour.
- `getClubAverages` performs no ownership check; `deleteSession` / `deleteShot`
  check only that *a* user is signed in.

## Build order

- [x] 1. Scaffold Expo + expo-router + styling + theme — **done**, bundles clean
- [x] 2. Convex project + port `schema.ts` — **done**, 17 tables live on `colorful-horse-279`
- [x] 3. Convex Auth — sign in / sign up + landing hero — **done**
- [x] 4. Onboarding → profile creation — **done**, 5 steps + coach roster
- [x] 5. Dashboard + 90-Day Program — **done**, curriculum ported (1,937 lines)
- [x] 6. Caddie mode — **done**, 18-course library, WHS handicap, club recommendation
- [x] 7. Launch Monitor + My Bag — **done**
- [x] 8. Stats / Analytics / Handicap / Streak — **done**, plus Guide and My Coach
- [~] 9. Swing video — **capture, library and storage done**; AI analysis needs an
  OpenAI API key on the deployment
- [ ] 10. 3D swing visualiser (`three.js` → `expo-gl`) — deferred, highest risk

## Known port challenges

1. **Auth is Hercules-locked.** `@usehercules/auth`, `@usehercules/vite`,
   `@usehercules/eslint-plugin` must all be removed. Convex Auth replaces them.
2. **3D swing visualiser.** `@react-three/fiber` + `three` need `expo-gl` on
   native. Deferred to last — everything else ships without it.
3. **Charts.** `recharts` is web-only. Needs a native replacement
   (`victory-native` or `react-native-svg`).
4. **shadcn/ui + Radix.** Web-only. Every UI primitive is rebuilt natively.
5. **Video capture.** Web `MediaRecorder` → `expo-camera` / `expo-av`.
6. **External API.** OpenGolfAPI course data — needs its own key.

## Credentials still needed

- [x] Convex account — done, project `mycoach-mycaddie-457e1`
- [x] Google OAuth — done, `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` set on the deployment
- [ ] OpenAI API key — for coach + swing analysis (needed at step 9)
- [ ] OpenGolfAPI key — optional; the built-in 18-course library covers step 6

## Launch checklist — do NOT do these during development

Deliberately deferred. None of them affect building or testing the app; all of
them must be done before real users sign in.

### 1. Google consent screen shows `colorful-horse-279.convex.site`

**Not a bug.** Google only renders a custom app name after brand verification;
until then it shows the raw redirect domain on purpose, so an unverified app
cannot impersonate a trusted brand. Setting **App name** under Google Auth
Platform → Branding is necessary but not sufficient.

To make it read "MyCoach / MyCaddie", in this order:

1. Add a Convex custom domain — e.g. `auth.dominusgolf.com` (paid plan feature)
2. Update the Google **Authorized redirect URI** to
   `https://auth.dominusgolf.com/api/auth/callback/google`
3. Verify that domain in Google Search Console
4. Publish a privacy policy and terms of service on it
5. Upload an app logo (a logo *requires* verification — the name alone is
   more lenient once the domain is verified)
6. Submit for brand verification — days to weeks

Pick the final app name before submitting: **changing the name after
verification triggers a fresh review.**

### 2. Publish the OAuth app to Production

Separate from brand verification, and easy to miss. While the app sits in
**Testing** (Google Auth Platform → Audience):

- only accounts explicitly added as test users can sign in
- sessions expire after 7 days, forcing repeated re-auth

Publishing to Production lifts both. Because the app only requests `email` and
`profile` — not sensitive or restricted scopes — publishing should not require
a full verification review.

### 3. Set `SITE_URL` on the deployment

Currently unset. Harmless for native, because the `redirect` callback in
`convex/auth.ts` allow-lists `mycoach://` and `exp://` explicitly. It becomes
required if a web build is ever shipped.

### 4. Replace the built-in course library with real data

`convex/lib/courses.ts` is plausible placeholder data, not authoritative
course data. `convex/lib/courseIntegrity.ts` repairs what is detectable —
duplicate stroke indices and pars that contradict their own yardage — and
`tests/courses.test.ts` asserts the result is self-consistent.

What it cannot repair is a hole whose par and yardage agree but are both wrong.
**TPC Sawgrass's 17th is listed as a 368-yard par 4**; it is the ~137-yard
island-green par 3. Internally consistent, externally false.

Fix by sourcing the library from OpenGolfAPI (`courseCache.ts` in the
reference already does this) or by correcting the data hole by hole against a
real scorecard. Until then, treat displayed yardages and pars as approximate.

### 5. Separate dev and prod OAuth clients

Convex production is a different deployment with a different domain, so it
needs its own Google OAuth client and its own redirect URI. Do not reuse the
dev credentials in production.
