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

**Last worked: 14 September 2026. Steps 1-8 complete, plus skills tests, swing
analysis, the coach chat, the voice features and custom courses; all pushed to
`main` (`f347ff0`). Working tree clean. 415 tests pass, lint is clean, and both
platform bundles build.**

Every "coming next" card is gone - the app has no placeholder copy left. Of the
five items that were listed as next up, three are done: voice, Convex function
tests, and custom courses. What remains is the 3D visualiser and real course
data, both deliberately deferred.

**Used on a phone this session:** the chat, the spoken caddie, dictation, and
the streaming replies. Each was fixed against what the device actually did, not
against what the code looked like - the audio session, the press race, the
empty commit and the dead realtime endpoint were all found that way.

**Not yet verified on a device:** the coach bubble's clearance above the tab
bar, and the My Courses form on a small screen - it is the longest form in the
app by some margin and nobody has scrolled it on a phone.

### Start the app

```bash
cd mobile
npx convex dev                 # terminal 1 - backend watcher
npx expo start --tunnel        # terminal 2 - must use --tunnel on this Wi-Fi
```

`--tunnel` is not optional on the "LQ Admin" network: it runs AP client
isolation, so the phone cannot reach Metro over the LAN. If port 8081 is busy,
an old Metro is still running - `Ctrl+C` it first.

ngrok needs an account now, and the authtoken is already saved to
`~/.ngrok2/ngrok.yml` on this machine, so `--tunnel` works as-is. On a new
machine it fails with a misleading `Cannot read properties of undefined
(reading 'body')` and a pointer to the ngrok status page; the real error is
`ERR_NGROK_4018`, visible by running
`node_modules/@expo/ngrok-bin-win32-x64/ngrok.exe http 8081 --log stdout`
directly. Fix with `...ngrok.exe authtoken <token>`.

### Working agreement

**Do not commit or push without being asked.** Build, verify, report, and leave
the working tree for review. Verification still runs every time.

### What is built

Every screen exists and no placeholder text remains anywhere in the app:

Landing, sign-in, onboarding, Home, 90-Day Program, Skills Test, My Caddie and
the round scorecard, My Coach, Ask Your Coach, My Swing, Profile, My Stats, My
Bag, My Handicap, My Analytics, My Streak, Launch Monitor, How to Use.

The coach chat is reached two ways: the card at the bottom of My Coach, and the
floating coach bubble on Home (bottom right). It opens as a modal, so the bubble
can present it over whatever the golfer was looking at.

Backend: `profiles`, `sessions`, `rounds`, `clubs`, `launchMonitor`, `shots`,
`skillTests`, `streaks`, `analytics`, `swingVideos`, `coachChat`, `voice`,
`customCourses`, `auth`, plus `devTools` (internal only). Shared pure logic in
`convex/lib`: `curriculum`, `caddie`, `courses`, `courseIntegrity`, `handicap`,
`streaks`, `skillTests`, `shotInsight`, `strokesGained`, `program`, `bag`,
`coachLevels`, `coachPersona`, `coachContext`, `voice`, `customCourses`,
`markdown`.

### Voice

Tap the mic, speak, tap stop. The words appear as they are said.

`voiceToken.ts` **was** portable after all - an earlier note here said it was
not. What could not be ported is the web app's *transport*: React Native has no
`RTCPeerConnection`. The same realtime API is reachable over a plain WebSocket,
which React Native does have, and `expo-audio`'s `useAudioStream` supplies the
raw PCM16 to feed it. `voice.realtimeToken` mints a short-lived session secret
so the key never reaches the device.

It posts to `/v1/realtime/client_secrets`, and the token comes back as a
top-level `value`. Not `/v1/realtime/sessions` - that is the beta endpoint the
reference app used and it now answers `Invalid URL`, which is what the first
attempt at this shipped with. The socket URL carries no `?intent=transcription`
for the same reason. Verified against the real API with a throwaway
`devTools` action rather than from the docs alone; the transcription model is
tried from a list, because which ones an account may use varies and a rejected
model returns a 400 indistinguishable from a broken endpoint.

`src/hooks/use-live-dictation.ts` owns that socket, and degrades on its own: if
the token cannot be minted, the socket will not open, or it drops mid-sentence,
it falls back to `useDictation` - record the whole thing, upload, transcribe
with Whisper, delete the audio in the same call. The golfer's interaction is
identical either way; only the live typing is lost. The banner above the
composer says which of the two is running.

`src/lib/base64.ts` is hand-rolled because React Native has no `Buffer` and
`btoa` is not reliably present, and this runs on every microphone buffer.

Three things decide how quickly words appear, and all three were wrong at
first:

- **`silence_duration_ms`**. Transcription is turn-based, so this number *is*
  the delay between saying a thing and seeing it. 600ms suits a conversational
  agent that must be sure you have finished; dictation wants 350ms.
- **When the microphone opens.** Capture now starts on the tap, and audio is
  queued until the token and handshake are done - otherwise the first second
  of every question was dropped on the floor.
- **What `stop` waits for.** It waits on the final transcript event, capped at
  1.5s, rather than sleeping a flat 900ms every time.

`stop` only sends `input_audio_buffer.commit` when at least 150ms of audio has
gone in since the server last took a turn. Server VAD usually commits at the
last pause, so an unconditional commit hits an empty buffer and the API says
so out loud: `buffer too small. Expected at least 100ms of audio`.

The header of `convex/voice.ts` records why the Hercules gateway was dropped
for direct OpenAI calls.

The spoken caddie is mostly *not* a model. `buildCaddieRecommendation` has
already decided the club and the yardage, so `buildShotBrief` in
`convex/lib/voice.ts` reads that aloud - deterministic, free, and incapable of
contradicting the card on screen. The model is only used to answer a question
(`askCaddie`) and to pull fields out of a spoken shot (`parseShot`).

Synthesised clips are cached in `voiceClips`, keyed by voice plus a hash of the
text, so a round does not pay for the same sentence eighteen times. Every
coach's `ttsVoice` was already on the persona; the speaking style is derived
from it rather than written out a second time.

Where it is: the mic and "Hear the brief" on the round scorecard, the mic and
"Play debrief" on a Launch Monitor session, and the mic plus a "Hear it" on
every coach reply in Ask Your Coach.

### Streaming coach replies

The reply is written into the chat as the model produces it, rather than
appearing whole after a wait. `generateReply` uses `coachAgent.streamText` and
flushes the running text into a `coachDrafts` row - one row per thread, cleared
the moment the finished message lands.

It does *not* use the agent component's own delta streaming, because
reassembling those on the device needs `@convex-dev/agent/react`, and that
entry point pulls `ai` and `@ai-sdk/provider-utils` into the Metro bundle -
exactly what rule 2 below exists to prevent. A single row read with plain
`useQuery` costs nothing and keeps the app bundle free of the AI SDK. It is
also why the draft is its own query rather than part of `listMessages`: that
one is paginated, and a token arriving would invalidate every page several
times a second.

Flush rate is in `STREAM_FLUSH_MS` / `STREAM_FLUSH_CHARS` - about six updates a
second, which reads as writing rather than as a stutter or a jump.

### Custom courses

`customCourses` had a table and nothing else. `convex/customCourses.ts` is the
CRUD, validated server-side because a bad slope rating silently bends the WHS
differential for every round played there. `convex/lib/customCourses.ts` holds
the validation and `toGolfCourse`, which converts a row into the same
`GolfCourse` the caddie, scorecard and handicap already take - so nothing
downstream needed a branch. Custom ids carry a `custom:` prefix, since they
share one namespace with library ids on `roundScores.courseId`.

The form is at `/courses`, reached from My Caddie. It opens on a real par-72
card rather than eighteen blanks. Deleting a course leaves finished rounds
intact: they keep their own name, rating and slope.

### Next up

1. **Step 10, the 3D swing visualiser** - `@react-three/fiber` on `expo-gl`.
   Highest risk, lowest value; everything ships without it. Still the only
   unbuilt item from the original plan.
2. **Real course data** - see the launch checklist. Needs an OpenGolfAPI key,
   and the launch checklist says deliberately not during development.
3. **Convex function tests, the rest of them** - `profiles`, `rounds`, `shots`,
   `launchMonitor`, `voice` and `customCourses` are covered (126 function
   tests). `sessions`, `skillTests`, `streaks`, `analytics`, `swingVideos` and
   `coachChat` are not. The harness is in `tests/helpers.ts` and the pattern is
   set, so these are now cheap to add.
4. **Green data for custom courses** - a custom course gets a deliberately
   neutral green, so the caddie's putt reading is generic there. Collecting
   break direction and severity per hole would fix it, at the cost of a much
   longer form.

Charts are drawn with `react-native-svg` in `src/components/ui/chart.tsx`
(`Sparkline`, `BarRow`, `CalendarHeat`, `HeroStat`) - single series, one hue,
direct labels. No chart library was needed.

### Rules that must not be broken

1. **Client code may only import from `convex/lib/*` and `convex/_generated/api`.**
   Importing a Convex *function* module (`convex/clubs.ts`, etc.) pulls
   `@convex-dev/auth/server` → `jose` → `node:buffer` into the bundle and Metro
   fails to resolve it. Shared constants belong in `convex/lib/`.
2. **Server-only dependencies must never be imported from `src/`.** The coach
   chat pulls in `@convex-dev/agent`, `ai` and `@ai-sdk/openai`. Convex bundles
   `convex/` separately from Metro, so these cost the app nothing - but only
   while no screen imports them. The chat screen talks to `api.coachChat.*`
   and nothing else; there is deliberately no `@convex-dev/agent/react`.
3. **Never use `toISOString().split('T')[0]` for a user-facing date.** That is
   UTC. The client sends its own local date via `localDate()` in
   `src/lib/date.ts`, and the server validates the format.
4. **Check ownership in every query and mutation.** Ids arrive from the client.
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
- [x] Skills tests - **done**, graded server-side against each level's bar
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
