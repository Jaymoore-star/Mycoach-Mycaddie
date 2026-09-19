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

**Last worked: 18 September 2026. The app is feature-complete and
release-shaped: real brand assets, valid native config, an EAS build profile,
course data from published scorecards, one account per email, and a seeded demo
golfer live on prod. 547 tests pass, lint is clean, and both bundles export.
Uncommitted — see "Release prep" below.**

**The Android APK is built and working.** Build `b3b04619`, profile `preview`,
installable from its Expo page. Two open questions before it goes further:
whether anyone in the room has an iPhone (this build does nothing for them -
iOS needs an Apple Developer account and TestFlight), and whether more than one
person will tap at once (everyone shares the single `demo@dominusgolf.com`
account against a live backend, so they would see each other's changes).

Prod (`precise-wren-85`) is provisioned and proven: all five environment
variables correct, a real sign-in with clean logs,
`devTools:probeIntegrations` green on every OpenAI endpoint, and
`demo@dominusgolf.com` seeded - 10.4 index, 89.9 average, 12 rounds, a 38-day
streak, 174 range shots.

**Verified on the installed APK** (build `b3b04619`, commit `b93e37f`): the
features were exercised on the real build, including recording a swing - the
path the missing `expo-image-picker` config would have crashed. That was the
last thing only a standalone build could prove.

**Last worked before that: 15 September 2026.** Steps 1-8 complete, plus skills
tests, swing analysis, the coach chat, the voice features and custom courses.

Every external integration was checked against the live deployment this
session, not just mocked: the realtime token mint, TTS, Whisper, the caddie
chat model and `gpt-4o` vision all answer. `OPENAI_API_KEY` **is** set on the
deployment, so step 9's swing analysis is no longer blocked on a key.

Every "coming next" card is gone - the app has no placeholder copy left. Of the
five items that were listed as next up, three are done: voice, Convex function
tests, and custom courses. What remains is the 3D visualiser and real course
data, both deliberately deferred.

**Used on a phone this session:** the chat, the spoken caddie, dictation, and
the streaming replies. Each was fixed against what the device actually did, not
against what the code looked like - the audio session, the press race, the
empty commit and the dead realtime endpoint were all found that way.

**Not yet verified on a device:** the My Courses form on a small screen - it is
the longest form in the app by some margin and nobody has scrolled it on a
phone. (The coach bubble was on this list until 18 September, when looking at
it found it broken - see "Release prep". Two of the three items on this list
turned out to be real bugs, which is the argument for clearing the third.)

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
2. **The rest of the course data.** Par and championship yardage are now
   transcribed from published scorecards (18 September). What is still
   approximate: regular and forward tees, stroke indices, course and slope
   ratings, and all green data. An OpenGolfAPI key would replace the lot.
3. **Green data for custom courses** - a custom course gets a deliberately
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

Tests live in `tests/` — 512 of them. The `*.test.ts` files cover the pure
logic in `convex/lib` (handicap, courses, caddie, curriculum); the
`*.functions.test.ts` files run the Convex functions themselves against
`convex-test`, which is the only way to cover the ownership checks and the
server-side gates. **Every function module is now covered.**

Two things about that harness are worth knowing before adding more:

- `testApp()` registers the `@convex-dev/agent` component, via the `register`
  helper the package ships at `@convex-dev/agent/test`. Without it every call
  into the coach chat fails with `Component "agent" is not registered`.
- `coachChat.sendMessage` schedules `generateReply`, which calls OpenAI. The
  chat tests cancel the queued job immediately. Left pending it runs in the
  background partway through some later test and prints a stack trace that
  belongs to neither — and on a machine with `OPENAI_API_KEY` in the
  environment it would not fail, it would spend real money running the suite.

### Fixed on 15 September 2026

Found by using the app on a phone and by writing the function tests, not by
reading the code.

- **Dictation committed an empty buffer.** `stop` decided whether to commit
  from a tally of the audio it had *sent*. With server VAD the server discards
  what is not speech, so the silence between the last word and the tap on stop
  piled up on the client while the server's buffer was genuinely empty — and
  the API said so, in red, under the composer. It now tracks whether the server
  has an open speech turn (`speech_started` / `speech_stopped`), which is the
  only reliable answer, and commits only when stopping mid-sentence.
- **The last sentence could be lost.** With nothing to commit, `stop` closed
  the socket immediately — including when VAD had committed a segment a moment
  earlier and its transcript was still in flight. It now waits for any
  transcript it is owed.
- **Live dictation had no audio-session recovery.** `useDictation` releases
  active players and retries the iOS session; `useLiveDictation` did neither,
  so tapping the mic straight after "Hear it" threw `Session activation
  failed`, which the hook read as the socket being unavailable — silently
  dropping the golfer to non-live recording for the rest of the session. Both
  paths now go through `claimRecordingSession` in `use-voice.ts`.
- **The caddie's answer read itself out loud.** `askCaddie` always synthesised
  the reply and the round screen played it the moment it arrived. Wrong twice
  over: a golfer reading a reply on a quiet course does not want their phone
  talking, and every question paid for a TTS clip whether or not anyone heard
  it. Synthesis is now behind a `speak` argument, off by default, and the
  answer carries a "Hear it" button like every other spoken line in the app.
  The brief and the answer share one speech hook, so starting one stops the
  other and only the button that started it reads "Stop".
- **Two of the three voice screens could not be typed into.** The round
  scorecard and a Launch Monitor session were speak-only: the transcript fired
  the instant the golfer tapped stop, with no field to hold it. A quiet
  clubhouse, a denied microphone permission or a misheard number left no way
  through at all. Both now use `VoiceComposer` in `components/ui/voice-controls.tsx`
  - a field you can type into *or* talk into, with the mic filling it rather
  than firing, so what was heard can be read and corrected before it is acted
  on. `MicButton` is gone; `MicCircle` and the composer replaced it, and
  Ask Your Coach now shares the same mic rather than styling its own.
- **The composer mic looked disabled.** It sat on `backgroundElement` with a
  muted icon — the exact pair the send button uses to render *itself* disabled.
  Now gold icon, gold ring, gold wash; the flat look is reserved for when the
  mic really cannot be tapped. Send keeps the solid fill, so there is still
  only one primary action in the composer.
- **Dictating twice replaced the first transcript** (all three screens now,
  via the shared composer). `onText` closed over
  `typedBeforeSpeaking` from the render *before* the tap, because `toggleMic`
  set the state and started the session in the same tick, and the session binds
  its handlers once at start. So the prefix was always the previous value. It
  is a ref now, read when the words arrive rather than when the closure was
  made.

Known and not fixed at the time — **both fixed on 18 September, see "Release
prep"**:

- `swingVideos.saveRecording` could not clean up a rejected upload.
- `voice.realtimeToken` minted a `silence_duration_ms` the client overrode.

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

## Release prep — 18 September 2026

Done this session. All of it was invisible while the app only ever ran through
`expo start`, and all of it stood between the app and something an investor can
hold.

### The build would have shipped, then crashed

`swing.tsx` calls `ImagePicker.requestCameraPermissionsAsync()` and
`launchCameraAsync`, but `expo-image-picker` was not in `app.json`'s plugins -
only `expo-audio` was. Expo Go carries every permission string in its own
Info.plist, so recording a swing worked all through development and would have
died the first time anyone tapped it in a standalone build. My Swing is a
headline feature. `expo-image-picker` and `expo-camera` are both configured
now, and `npx expo config --type introspect` confirms
`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` and
`android.permission.CAMERA` reach the manifest.

**This is the class of bug that only a real build finds.** `npm run verify` and
`expo export` both passed with it in place.

### It wore the Expo template's clothes

`icon.png` was the default blue Expo chevron, `splash-icon.png` was blank, the
splash background was Expo blue `#208AEF` and the Android adaptive background
`#E6F4FE`. Every icon is now generated from the official Dominus mark - the
same crescent-and-pin paths the web app draws, in
`reference/src/components/ui/dominus-logo.tsx` - in gold on `#141311`.

The generator is `mobile/scripts/make-icons.js` (needs `npm i -D sharp`; it runs by hand when the mark changes, not as part of a build). It renders the mark large on
transparency, **trims to its real content bounds**, then centres it: the
artwork is not centred inside its own 100x120 viewBox (the crescent reaches
x=88, the pin starts at x=43), so scaling the viewBox leaves the mark visibly
pushed right. The Android foreground uses 42% coverage because the launcher
masks away the outer third.

Every other template asset was deleted after checking nothing referenced it -
`logo-glow.png`, `tutorial-web.png`, the react logos, `tabIcons/`, the
`expo.icon` bundle.

### Nothing to distribute

There was no `eas.json`, no `ios.bundleIdentifier`, no `android.package`. Added
all three, plus `development` / `preview` / `production` profiles. Bundle id
and package are `com.dominusgolf.mycoachmycaddie`.

**`preview` carries `EXPO_PUBLIC_CONVEX_URL` in its `env` block on purpose.**
`.env*.local` is gitignored, so EAS never uploads it and the build would
otherwise come out pointing at nothing.

### The course library was invented, not approximate

The note here used to say TPC Sawgrass's 17th was the one hole that was
externally false. It was not close to the one. The library is now transcribed
from published scorecards, one per course, listed in the header of
`convex/lib/courses.ts`. What was wrong:

- **Sawgrass had 17 and 18 swapped.** The island green was a 385-yard par 4 and
  the closing hole a 133-yard par 3.
- **St Andrews played the Road Hole as a par 5.**
- **Riviera's drivable 315-yard 10th had moved to the 16th.**
- **Eight of the eighteen courses totalled the wrong par** - Augusta 73,
  Pebble 73, Bethpage 74, Oakmont 73.

`courseIntegrity.ts` had to change with it. It re-derived par from yardage,
which was right while the data was invented and wrong the moment it was real:
the bands turn Oakmont's 289-yard par 3 into a par 4, Winged Foot's 565-yard
par 4 into a par 5, and Riviera's 10th into something else again. **It took the
corrected library and broke it in exactly the famous places.** Par is now taken
as authored; `findCourseIssues` still flags an impossible pairing, with bounds
drawn round what real holes do, and reports rather than rewrites.
`parForYardage` survives because custom courses use it to *suggest* a par.

Still approximate, and said so in the header: regular and forward tees (scaled
from championship by each hole's original ratio), stroke indices (except Bandon
Dunes), course and slope ratings, and all green data.

### A fresh account showed zeros

`convex/seed.ts` - `internalMutation`, same reasoning as `devTools.ts` - fills
one account with five months of golf:

```bash
npx convex run seed:demoGolfer '{"email":"demo@dominusgolf.com"}'
```

Sign up in the app with that address first. It is deterministic (same email and
date give the same golfer) and clears its own previous output, so running it
twice leaves one demo golfer rather than two.

It produces an 11.4 index, a 91.3 scoring average, 12 rounds of 87-96 across
the real course library, a live 38-day streak, a full bag with carry numbers,
two passed skills gates, three launch monitor sessions and day 24 of 90.

Two things worth knowing if you retune it. It reports the index by calling the
app's own `handicapIndex()` rather than averaging differentials itself - a
hand-rolled "best 8" disagreed with the screen, because WHS Rule 5.2a averages
the best **4** of a 12-round record. And the scoring rates are set against the
handicap, not against what looks right per hole: the library is all
championship courses rated 73-77, so rounds have to be near +19 for the
differential to read as a low teens index. The first pass felt like sensible
golf and produced a 6.9.

### Two known bugs, both fixed

- **`swingVideos.saveRecording` could not clean up a rejected upload.** It
  deleted the orphaned files and then threw, and a mutation is one transaction,
  so the throw rolled the deletes back and both files survived - billable
  forever, reachable by nothing. It is an `action` now: check ownership, run a
  cleanup mutation, then throw. Three transactions. The client calls it with
  `useAction`, and the test that asserted the broken behaviour now asserts the
  fix.
- **`voice.realtimeToken` minted with `silence_duration_ms: 600`** while the
  client overrode it to 350. Both now read `LIVE_VAD` from `convex/lib/voice.ts`
  - the only place a constant shared by both ends can live.

### One account per email

Signing up with Google and then with a password, on the same address, used to
produce **two separate golfers** - two profiles, two sets of rounds, no hint
that anything was wrong. The person would sign in the other way one day and
find their game gone.

It was not a bug in the library. `createOrUpdateUser` links a new sign-in to an
existing user only when that user's email is *verified*
(`uniqueUserWithVerifiedEmail`), and neither direction qualifies here: the
Password provider never sets `emailVerificationTime`, because this app sends no
verification mail. Convex Auth was refusing to link, on purpose.

**It is right to refuse.** Linking on an unverified address is the account
pre-hijacking attack: register `you@gmail.com` with a password before the owner
does, wait for them to sign in with Google, and inherit everything they put in
the app. The reverse - a password set against an existing Google account - is a
permanent key to it.

So `convex/auth.ts` keeps the refusal and makes it legible. A second method on
an existing address now throws `ACCOUNT_EXISTS` naming the method that address
already uses ("That email already has an account created with Google"), which
the sign-in screen shows verbatim. Addresses are stored lower-cased so the
check cannot be walked past with `Demo@` versus `demo@`.

Two things to know if you touch it:

- Defining `createOrUpdateUser` **replaces** the default entirely, including
  its email-verified linking and its `afterUserCreatedOrUpdated` hook. The
  insert here mirrors the default's shape; keep them in step.
- The callback's `ctx` is typed against a generic data model, so it knows none
  of this app's indexes. `ctx.db` is cast to the generated `DatabaseWriter` -
  the runtime object is the real one, only the type is widened.

`tests/auth.functions.test.ts` drives the real `auth:signIn` rather than
`withIdentity`, which is why it is the only test file that needs a signing key:
it generates a throwaway RS256 PEM per run, because `importPKCS8` rejects
anything that is not a genuine PKCS#8 key.

**Proper account linking needs email verification** - an emailed code proving
the person owns the address. Worth doing the day this app sends mail; until
then, one method per account is the honest behaviour.

### A build switch for Google sign-in

`src/constants/features.ts` holds `GOOGLE_SIGN_IN_ENABLED`, read from
`EXPO_PUBLIC_GOOGLE_SIGN_IN` and **on by default**. The sign-in screen wraps
both the Google button and the "or" divider above it in that flag, so turning
it off ends the screen cleanly at Sign In rather than leaving a stray
separator.

It is on in every build profile. It exists because it looked for a while as
though Testing mode would block outside accounts; it does not (see the Google
note below). Left in place because it is the difference between one line in
`eas.json` and a code change if that ever stops being true.

**`EXPO_PUBLIC_*` and the Metro cache.** Metro's transform cache is keyed on
file contents, not on environment variables, so changing one and rebuilding
locally silently reuses the previous value. Two exports of this flag came back
identical until `--clear` was added, which read as "the flag does not work"
when the flag was fine. Any local build that sets an `EXPO_PUBLIC_*` variable
needs `--clear`. EAS builds run in a fresh container, so they are not affected.

To see what a bundle actually baked in, export without Hermes and read the
constant directly:

```bash
npx expo export --platform android --no-bytecode --clear --output-dir /tmp/b
grep -oE 'GOOGLE_SIGN_IN_ENABLED.{0,60}' /tmp/b/_expo/static/js/android/*.js
#  ...var t=!0   → enabled
#  ...var t=!1   → disabled
```

Grepping the bundle for the button's label does **not** work - Metro does not
eliminate the string across a module boundary, so "Continue with Google" is
present eitherpway.

### Checking a deployment's wiring, not just its code

`devTools.probeIntegrations` calls every external service the app depends on,
against whichever deployment it is pointed at:

```bash
npx convex run devTools:probeIntegrations --prod
```

It checks `gpt-4o` and `gpt-4o-mini` chat, vision with a real image payload,
text-to-speech, transcription, and the realtime token mint. Transcription is a
round trip - it speaks a sentence, feeds the audio back to Whisper, and
asserts the words survive - so both halves of dictation are tested against each
other rather than either being trusted alone. A run costs a fraction of a cent
and writes nothing.

It exists because of how 18 September went. Three of the five environment
variables copied to prod arrived corrupted: the shell never evaluated the
`$(npx convex env get ...)` substitution, so the literal command text was
stored in front of each real value. `JWT_PRIVATE_KEY`, `JWKS` and
`OPENAI_API_KEY` were all 22-ish characters too long. Every sign-in failed with
`Uncaught TypeError: "pkcs8" must be PKCS#8 formatted string`, and chat, speech,
transcription and swing analysis were all dead too.

**All 534 tests were green throughout.** They test the app's logic; they cannot
test whether a deployment's secrets are real. Two habits close that gap:

- Compare lengths between deployments rather than eyeballing. `devLen` vs
  `prodLen` found this in one command.
- **`jwks.json` returning 200 does not prove auth works.** `JWKS` is a separate
  public value; the private key can be garbage while that endpoint answers
  perfectly. Checking it and declaring auth healthy is what delayed finding
  this. `npx convex logs --history 30 --prod` is the check that actually
  answers the question.

Copy secrets between deployments through the Convex dashboard, or from Git Bash
where `$(...)` genuinely expands - not PowerShell or cmd.

### One flaky test

`coachChat.functions.test.ts` timed out against vitest's 5s default under full
suite load - it is the first test to register the agent component into a cold
in-memory deployment, and takes 600ms on its own. `testTimeout` is 20s now. A
release gate that fails at random is worse than a slow one.

### Deployments

| | Deployment | Used by |
|---|---|---|
| dev | `colorful-horse-279` | `npx convex dev`, Expo Go |
| **prod** | **`precise-wren-85`** | the EAS `preview` and `production` builds |

Provisioned 18 September. `eas.json` points both build profiles at prod;
`.env.local` still points local development at dev, which is what you want.

### Runbook — Android APK for investors

EAS project: **`@jeet2111/mycoach-mycaddie`**
(`cdb607b7-376d-45e9-98c9-91a35c67c3a6`), already linked in `app.json`.

**1. Give prod its environment. — DONE, 18 September.** All five are set:
`JWT_PRIVATE_KEY`, `JWKS`, `OPENAI_API_KEY`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`. The Google pair is a *separate production OAuth client*,
not dev's - dev's is registered against the dev domain and Google would refuse
the callback.

Worth knowing if it ever breaks: Convex Auth will not issue a session without
`JWT_PRIVATE_KEY` and `JWKS`, and the symptom is that **nobody can sign in at
all, not even with a password**. The check is one request, no credentials
needed - 500 means they are missing:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://precise-wren-85.convex.site/.well-known/jwks.json    # expect 200
```

To copy a value between deployments without it passing through a clipboard:

```bash
npx convex env set JWKS "$(npx convex env get JWKS)" --prod
```

`SITE_URL` stays unset: the `redirect` callback in `convex/auth.ts` allow-lists
`mycoach://` explicitly, which is what the APK uses.

**2. Build.**

```bash
npx eas-cli@latest build -p android --profile preview
```

First run offers to generate an Android keystore - say yes, and let EAS keep
it. Build takes 10-20 minutes and returns an `.apk` link that installs
directly. No Apple account, no store review, no cost.

**3. Seed the demo account on prod.** Sign up in the APK with the demo address
first, then:

```bash
npx convex run seed:demoGolfer '{"email":"demo@dominusgolf.com"}' --prod
```

**Resetting between pitches.** Sign-ups accumulate on the demo deployment, and
a half-onboarded stale account is what derails a walkthrough.
`devTools.resetDeployment` clears every account and everything hanging off one,
including stored swing clips and cached voice audio - deleting only the rows
would leave those blobs billable and unreachable:

```bash
npx convex run devTools:resetDeployment \
  '{"confirm":"DELETE ALL ACCOUNTS AND DATA"}' --prod
```

The phrase is required, and a near miss throws rather than doing something
irreversible. It leaves `courseCache` alone - fetched reference data, not
anybody's account. Afterwards sign up again and re-run the seed; auth keeps
working, the deployment is just empty.

In PowerShell the inner quotes need escaping - `'{\"confirm\":\"...\"}'` - or
use Git Bash, where the plain form works.

**Google sign-in.** The production OAuth client is registered and Google accepts
`https://precise-wren-85.convex.site/api/auth/callback/google` - confirmed by
calling Google's authorize endpoint with that client and redirect and getting a
sign-in page rather than `redirect_uri_mismatch`. That path is not a guess:
`@convex-dev/auth` builds it as `CONVEX_SITE_URL + "/api/auth/callback/" +
providerId` (`dist/server/oauth/convexAuth.js`).

It must be a **Web application** client, not an Android one. The flow never
terminates in the app - Google redirects to the Convex HTTP endpoint, which
exchanges the code server-side and then deep-links back via `mycoach://`. An
Android client, the kind that wants a SHA-1 fingerprint, cannot work here.

**The consent app is in Testing, and that is fine.** Testing is usually
described as restricting sign-in to accounts on the test-user list, which would
have made the button a dead end for anyone in a pitch. It was tested on a
device with an account that was not on the list and it signed in normally: that
restriction travels with *sensitive or restricted* scopes, and this app asks
only for `openid`, `email` and `profile`. Google counts those sign-ins in the
"other" bucket of the 100-user cap on the Audience page, which is the number to
watch if you want to confirm it yourself - `(n test, m other)` with `m > 0`
means outside accounts are getting through.

What Testing does still impose: **100 accounts for the lifetime of the app**,
and a Google refresh grant that expires after 7 days. The latter ends the
*Google* grant, not the app session - Convex Auth issues its own JWT once the
code is exchanged - so nobody is signed out of the app.

Publishing is therefore not on the critical path. If you do want it: Google
will not let you publish until the Branding page has a home page, privacy
policy and terms URL, all on a domain in Authorised domains and verified in
Search Console. **And the uploaded logo forces a verification review on
publish** - Google says so on that page. The logo is free while in Testing.

The consent screen will read `precise-wren-85.convex.site` until brand
verification, which needs a Convex custom domain (paid plan), that domain
verified in Search Console, and a privacy policy and terms published on it.
Pick the final app name before submitting - changing it afterwards triggers a
fresh review.

**Watch the OpenAI tier.** 30k TPM caps swing analysis at ~24 frames, and
several people demoing at once will see 429s.

### The coach bubble, verified on a device at last

It was listed here for two sessions as "not yet verified on a device", and the
first time anyone looked at it, it was broken: the label read **"Ask / Mas /
on"**, wrapped three lines deep and split mid-word.

The label was absolutely positioned inside the 56pt circle, so React Native
measured it against a 56pt containing block - `right: 62` moves a box, it does
not widen it. Label and portrait are siblings in a row now, and the row is what
floats, so the label takes the width its text needs. `numberOfLines={1}` as
well, so a longer coach name can never bring the wrap back.

The clearance above the tab bar was fine.

Still not verified on a device: the My Courses form on a small screen.

## Build order

- [x] 1. Scaffold Expo + expo-router + styling + theme — **done**, bundles clean
- [x] 2. Convex project + port `schema.ts` — **done**, 17 tables live on `colorful-horse-279`
- [x] 3. Convex Auth — sign in / sign up + landing hero — **done**
- [x] 4. Onboarding → profile creation — **done**, 5 steps + coach roster
- [x] 5. Dashboard + 90-Day Program — **done**, curriculum ported (1,937 lines)
- [x] 6. Caddie mode — **done**, 18-course library, WHS handicap, club recommendation
- [x] 7. Launch Monitor + My Bag — **done**
- [x] 8. Stats / Analytics / Handicap / Streak — **done**, plus Guide and My Coach
- [x] 9. Swing video — **done**; the key is set and `gpt-4o` vision accepts the
  frames. Not yet exercised end to end with a real clip on a device.
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
- [x] OpenAI API key — set on the deployment; verified live against every
      endpoint the app uses (realtime, TTS, Whisper, chat, vision)
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

**Mostly done on 18 September** — par and championship yardage for all 18
courses are transcribed from published scorecards, listed in the header of
`convex/lib/courses.ts`. See "Release prep" for what was wrong and why
`courseIntegrity.ts` had to stop re-deriving par.

Still approximate, and the reason to keep this item open: regular and forward
tee yardages, stroke indices (except Bandon Dunes), course and slope ratings,
and all green data. Sourcing the library from OpenGolfAPI (`courseCache.ts` in
the reference already does this) would replace all of it at once.

### 5. Separate dev and prod OAuth clients

Convex production is a different deployment with a different domain, so it
needs its own Google OAuth client and its own redirect URI. Do not reuse the
dev credentials in production.
