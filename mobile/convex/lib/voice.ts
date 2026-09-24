/**
 * Everything the voice features say, decided without a network call.
 *
 * The spoken caddie is mostly *not* a language model. `buildCaddieRecommendation`
 * has already worked out the club, the yardage adjustments and the aim, so
 * reading that aloud is a formatting problem, not a reasoning one - and a
 * deterministic script costs nothing, never contradicts the card on screen,
 * and cannot invent a yardage. The model is reserved for the two jobs that do
 * need it: answering a question the golfer asked, and pulling structured shot
 * fields out of a sentence.
 *
 * Lives in `convex/lib` because the client needs the script builders too: the
 * round screen already holds the recommendation, so it can ask for speech
 * without the server recomputing it.
 */
import { BAG_ORDER } from './bag';
import type { CaddieRecommendation } from './caddie';
import type { CoachProfile } from './coachPersona';
import { MANUAL_CADDIE_CORE } from './manual';

/** OpenAI's TTS voices. Mirrors `TtsVoice` in `coachPersona.ts`. */
export const TTS_VOICES = [
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
  'coral',
  'ash',
  'sage',
  'ballad',
  'verse',
] as const;

/**
 * How the coach's voice should sound.
 *
 * Derived from the roster rather than written out per voice. The reference app
 * kept a second hand-written table of caddie personalities beside the coach
 * list, and the two drifted; here the persona is the single source, so a coach
 * whose style changes starts sounding different on the next utterance.
 */
export function ttsInstructionsFor(coach: CoachProfile): string {
  return (
    `You are ${coach.name}, a golf caddie speaking to a player between shots. ` +
    `${coach.coachingStyle}. ${coach.tagline} ` +
    'Speak at a measured, unhurried pace, as if standing beside the player. ' +
    'Confident and clear, never rushed or theatrical.'
  );
}

// ─── Reading the caddie card aloud ───────────────────────────────────────────

/** "7-Iron" -> "7 iron", so the voice does not spell out the hyphen. */
function speakClub(club: string): string {
  return club
    .replace(/-/g, ' ')
    .replace(/\bPW\b/, 'pitching wedge')
    .replace(/\bGW\b/, 'gap wedge')
    .replace(/\bSW\b/, 'sand wedge')
    .replace(/\bLW\b/, 'lob wedge');
}

/**
 * The shot brief, spoken.
 *
 * Deliberately short. A player standing over the ball wants the club, the
 * number and one thought - the full card is on screen for everything else.
 */
export function buildShotBrief(
  rec: CaddieRecommendation,
  holeNumber: number,
  par: number,
): string {
  const lines: string[] = [];

  lines.push(`Hole ${holeNumber}, par ${par}.`);

  // The adjusted number is the one to hit; the raw number is what the card
  // says. Saying both only when they differ keeps the brief short on a calm
  // day and explains itself on a windy one.
  if (rec.adjustedYardage !== rec.rawYardage) {
    lines.push(
      `${rec.rawYardage} yards on the card, playing ${rec.adjustedYardage}.`,
    );
  } else {
    lines.push(`${rec.adjustedYardage} yards.`);
  }

  lines.push(`${speakClub(rec.primaryClub)}.`);
  lines.push(`${rec.aimAdjustment}.`);
  lines.push(`${rec.landingTarget}.`);

  if (rec.layupRecommendation) lines.push(`${rec.layupRecommendation}.`);

  // One cue, not the list. Three swing thoughts over the ball is none.
  if (rec.preShotCues.length > 0) lines.push(`${rec.preShotCues[0]}.`);

  lines.push(rec.caddieQuip);

  return lines.join(' ').replace(/\.\./g, '.');
}

// ─── Reading a launch monitor session aloud ──────────────────────────────────

export type SpokenSession = {
  label?: string;
  club?: string;
  shotCount: number;
  avgCarryYards?: number;
  avgBallSpeedMph?: number;
  avgSmashFactor?: number;
  avgSpinRpm?: number;
};

export type SpokenShot = {
  carryYards?: number;
  shotShape?: string;
  contactType?: string;
};

/** Plural that reads correctly when spoken: "1 shot", "12 shots". */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * A caddie-style read-out of a range session.
 *
 * Every line is conditional on the data actually existing. A Garmin R10 logs
 * spin and smash factor; a session typed in by hand may carry nothing but
 * carry distances, and reading "average spin rate: undefined" aloud is worse
 * than saying nothing.
 */
export function buildSessionSummary(session: SpokenSession, shots: SpokenShot[]): string {
  const label = session.label ?? (session.club ? `${session.club} session` : 'practice session');
  const lines: string[] = [];

  lines.push(`Here is your ${label} summary.`);
  lines.push(`You hit ${plural(session.shotCount, 'shot')}.`);

  if (session.avgCarryYards != null) {
    lines.push(`Average carry: ${session.avgCarryYards} yards.`);
  }
  if (session.avgBallSpeedMph != null) {
    lines.push(`Average ball speed: ${session.avgBallSpeedMph} miles per hour.`);
  }
  if (session.avgSmashFactor != null) {
    lines.push(`Average smash factor: ${session.avgSmashFactor}.`);
  }
  if (session.avgSpinRpm != null) {
    lines.push(`Average spin rate: ${Math.round(session.avgSpinRpm)} R P M.`);
  }

  // A spread needs enough shots to mean something; two shots is not a pattern.
  const carries = shots.map((s) => s.carryYards).filter((n): n is number => n != null);
  if (carries.length >= 3) {
    const best = Math.max(...carries);
    const worst = Math.min(...carries);
    lines.push(
      `Best carry was ${best} yards, shortest was ${worst} - a ${best - worst} yard spread.`,
    );
  }

  const shapes = new Map<string, number>();
  for (const s of shots) {
    if (s.shotShape) shapes.set(s.shotShape, (shapes.get(s.shotShape) ?? 0) + 1);
  }
  const topShape = [...shapes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topShape) {
    lines.push(`Most common shape: ${topShape[0]}, ${plural(topShape[1], 'time')}.`);
  }

  const solid = shots.filter((s) => s.contactType === 'solid').length;
  if (solid > 0 && shots.length > 0) {
    lines.push(`${Math.round((solid / shots.length) * 100)} percent solid contact.`);
  }

  if (session.avgSmashFactor != null) {
    if (session.avgSmashFactor >= 1.48) {
      lines.push("Excellent energy transfer - you're compressing the ball well.");
    } else if (session.avgSmashFactor >= 1.42) {
      lines.push('Solid smash factor. More centre-face contact unlocks the rest.');
    } else {
      lines.push('Smash factor has room to grow. Centre-face contact is the next session.');
    }
  }

  // Driver spin is the one number where both ends are a fault, so it is worth
  // calling out in either direction.
  if (session.avgSpinRpm != null && session.club?.toLowerCase() === 'driver') {
    if (session.avgSpinRpm > 3000) {
      lines.push('Driver spin is on the high side - check your attack angle and tee height.');
    } else if (session.avgSpinRpm < 2200) {
      lines.push("Driver spin is very low - make sure you're not delofting excessively.");
    }
  }

  lines.push('Good work out there.');

  return lines.join(' ');
}

// ─── Parsing a spoken shot ───────────────────────────────────────────────────

export const SHOT_SHAPES = [
  'straight',
  'draw',
  'fade',
  'hook',
  'slice',
  'push',
  'pull',
] as const;

export const CONTACT_TYPES = ['solid', 'fat', 'thin', 'toe', 'heel', 'top'] as const;

export const BALL_FLIGHTS = ['penetrating', 'mid', 'high', 'low'] as const;

export type ParsedShot = {
  club?: string;
  targetDistanceYards?: number;
  actualDistanceYards?: number;
  shotShape?: (typeof SHOT_SHAPES)[number];
  ballFlight?: (typeof BALL_FLIGHTS)[number];
  contactType?: (typeof CONTACT_TYPES)[number];
  notes?: string;
};

/**
 * The extraction prompt.
 *
 * The club list is interpolated from `BAG_ORDER` rather than typed out, so a
 * club added to the bag is a club the model is allowed to return. The
 * reference app hard-coded a different list than its own schema accepted, so
 * "5-Hybrid" came back and was silently dropped.
 */
export const SHOT_PARSE_SYSTEM_PROMPT = `You extract golf shot data. The user just hit a shot on the range or the course and described it out loud.

Return JSON with only the fields they actually mentioned. Omit everything else - do not guess.

Fields:
- club: one of ${BAG_ORDER.join(', ')}
- targetDistanceYards: number, the distance they were aiming for
- actualDistanceYards: number, how far it actually went
- shotShape: one of ${SHOT_SHAPES.join(', ')}
- ballFlight: one of ${BALL_FLIGHTS.join(', ')}
- contactType: one of ${CONTACT_TYPES.join(', ')}
- notes: anything else useful, max 200 characters

Return ONLY the JSON object, no explanation or code fences.
Example input: "seven iron, went about 145, little fade, caught it clean"
Example output: {"club":"7-Iron","actualDistanceYards":145,"shotShape":"fade","contactType":"solid"}`;

/** Wedges are the only clubs whose spoken name shares nothing with the bag name. */
const CLUB_ALIASES: Record<string, string> = {
  pitchingwedge: 'PW',
  gapwedge: 'GW',
  approachwedge: 'GW',
  sandwedge: 'SW',
  lobwedge: 'LW',
};

/** A golfer says "seven iron"; the bag says "7-Iron". */
const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

/** Punctuation and spacing are noise here: "7-Iron", "7 iron" and "7iron" are one club. */
function clubKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Matches a model's club string to a name the bag actually holds.
 *
 * Returning `undefined` rather than a guess is the safe failure: an
 * unrecognised club is dropped and the golfer picks one, whereas a wrong club
 * quietly poisons that club's carry average and every recommendation built on
 * it.
 */
export function normalizeClub(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let key = clubKey(raw);
  if (key.length === 0) return undefined;

  // Spoken numbers become digits first, which collapses most of the variation
  // before anything else has to deal with it.
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    if (key.startsWith(word)) {
      key = digit + key.slice(word.length);
      break;
    }
  }

  const exact = BAG_ORDER.find((c) => clubKey(c) === key);
  if (exact) return exact;

  const alias = CLUB_ALIASES[key];
  if (alias) return alias;

  // This bag carries one hybrid, so every numbered hybrid is that hybrid.
  if (key.endsWith('hybrid')) return 'Hybrid';

  // A club the chart does not carry separately falls to its nearest
  // neighbour: a 3-iron goes in as the 4-iron rather than being lost.
  const iron = /^(\d)iron$/.exec(key);
  if (iron) return Number(iron[1]) < 4 ? '4-Iron' : '9-Iron';

  const wood = /^(\d)wood$/.exec(key);
  if (wood) {
    const number = Number(wood[1]);
    return number <= 1 ? 'Driver' : number <= 3 ? '3-Wood' : '5-Wood';
  }

  if (key.endsWith('wedge')) return 'PW';

  return undefined;
}

function pickFrom<T extends readonly string[]>(
  allowed: T,
  raw: unknown,
): T[number] | undefined {
  if (typeof raw !== 'string') return undefined;
  const lower = raw.toLowerCase().trim();
  return allowed.find((a) => a === lower) as T[number] | undefined;
}

/** A yardage only counts if it is a real number in a plausible range. */
function pickYards(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return undefined;
  return Math.round(n);
}

/**
 * Coerces the model's JSON into fields the shot log will accept.
 *
 * Anything unrecognised is dropped rather than passed through: `logShot`
 * validates these against the schema's unions, so a stray "banana" shape
 * would fail the whole mutation and lose the shot the golfer just described.
 */
export function normalizeParsedShot(raw: unknown): ParsedShot {
  if (typeof raw !== 'object' || raw === null) return {};
  const input = raw as Record<string, unknown>;

  const shot: ParsedShot = {};

  const club = normalizeClub(typeof input.club === 'string' ? input.club : undefined);
  if (club) shot.club = club;

  const target = pickYards(input.targetDistanceYards);
  if (target !== undefined) shot.targetDistanceYards = target;

  const actual = pickYards(input.actualDistanceYards);
  if (actual !== undefined) shot.actualDistanceYards = actual;

  const shape = pickFrom(SHOT_SHAPES, input.shotShape);
  if (shape) shot.shotShape = shape;

  const flight = pickFrom(BALL_FLIGHTS, input.ballFlight);
  if (flight) shot.ballFlight = flight;

  const contact = pickFrom(CONTACT_TYPES, input.contactType);
  if (contact) shot.contactType = contact;

  if (typeof input.notes === 'string' && input.notes.trim()) {
    shot.notes = input.notes.trim().slice(0, 200);
  }

  return shot;
}

// ─── Asking the caddie a question ────────────────────────────────────────────

export type CaddieVoiceContext = {
  playerName: string;
  skillLabel: string;
  holeNumber?: number;
  par?: number;
  distanceToPin?: number;
  windMph?: number;
  windDirection?: string;
  lie?: string;
  primaryClub?: string;
  adjustedYardage?: number;
  aimAdjustment?: string;
};

/**
 * The system prompt for a spoken caddie answer.
 *
 * The level guidance is the same gate the written coach uses: a level 1 coach
 * who starts talking about spin axis has broken the curriculum, and a spoken
 * answer is no less binding than a typed one. `avoidKeywords` comes straight
 * off the persona so the two cannot disagree.
 */
export function buildCaddieSystemPrompt(
  coach: CoachProfile,
  ctx: CaddieVoiceContext,
  /** At most one short section of the manual that bears on the question. */
  manualPassage = '',
): string {
  const spec = coach.levelSpec;

  const situation: string[] = [];
  if (ctx.holeNumber) situation.push(`Hole ${ctx.holeNumber}, par ${ctx.par ?? 4}`);
  if (ctx.distanceToPin) situation.push(`${ctx.distanceToPin} yards to the pin`);
  if (ctx.lie) situation.push(`ball in the ${ctx.lie}`);
  if (ctx.windMph) situation.push(`${ctx.windDirection ?? 'wind'} at ${ctx.windMph} mph`);
  if (ctx.primaryClub) {
    situation.push(
      `your own club recommendation is ${ctx.primaryClub}` +
        (ctx.adjustedYardage ? ` playing ${ctx.adjustedYardage} yards` : ''),
    );
  }
  if (ctx.aimAdjustment) situation.push(`aim note: ${ctx.aimAdjustment}`);

  return [
    `You are ${coach.name}, a golf caddie on the course with ${ctx.playerName}, a ${ctx.skillLabel} golfer.`,
    `Style: ${coach.coachingStyle}. ${coach.tagline}`,
    situation.length > 0 ? `Current situation: ${situation.join('. ')}.` : '',
    `Teach only at this level: ${spec.breakingScore} - ${spec.subtitle}.`,
    `Vocabulary you use: ${spec.keyVocabulary.join(', ')}.`,
    `Never mention: ${spec.avoidKeywords.join(', ')}.`,
    // The manual is the authority, and the persona still carries some of the
    // older edition's terms; the caddie speaks the current book's.
    MANUAL_CADDIE_CORE,
    'Where the vocabulary above differs from the manual, use the manual.',
    manualPassage ? `A passage from the manual that bears on this question:\n${manualPassage}` : '',
    'You are being heard, not read. One or two short sentences, no lists, no headings,',
    'no markdown, no emoji. Say the number and the club, then one thought. Never',
    'contradict the club recommendation above - if you disagree, explain the trade-off',
    'in a sentence and let the player choose.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Server-side voice activity detection for live dictation.
 *
 * `silence_duration_ms` *is* the delay between saying a thing and seeing it:
 * transcription is turn-based, so the server waits this long for more speech
 * before committing the segment and transcribing it. 600ms suits a
 * conversational agent that must be sure the speaker has finished; dictation
 * wants shorter segments arriving sooner, even at the cost of the occasional
 * split at a natural pause.
 *
 * Lives here because both ends need the same numbers. `voice.realtimeToken`
 * mints the session with them and the client restates them in `session.update`
 * when the socket opens - written out separately, the two drifted apart and
 * the mint asked for 600ms while the client overrode it to 350ms.
 */
export const LIVE_VAD = {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 200,
  silence_duration_ms: 350,
} as const;
