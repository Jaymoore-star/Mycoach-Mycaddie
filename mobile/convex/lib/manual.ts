import { MANUAL_SECTIONS, type ManualSection } from './manualContent';

/**
 * What the AI knows of the Dominus Golf manual, and how it finds the rest.
 *
 * The manual - "The Ultimate Guide to Master the Game, Tour Pure Edition" - is
 * about 20k tokens. The account's OpenAI allowance is 30k tokens a minute, so
 * sending it whole with every chat turn would leave room for one reply a
 * minute across every golfer. Instead each prompt carries:
 *
 *   - `MANUAL_CORE`, a page of the facts the coach must never get wrong: what
 *     Tour Pure is, the eight letter checkpoints, the Club Map, weight by shot
 *     type, the wedge clock, the 100 Rule. Condensed from the book, not added to.
 *   - The few sections most relevant to the question, found by `searchManual`.
 *
 * The search is keyword scoring over the sections, in code - no embeddings, no
 * extra API call, no database table. At 45 sections that is instant, costs
 * nothing, and is testable: a golfer asking about a slice gets the slice
 * sections, deterministically.
 *
 * The manual is the authority. The app's drill cards and coach personas were
 * written against an earlier edition that numbered the swing P1 to P10 and set
 * the wedge clock at 8:00 / 9:00 / 10:00; the core says how those map, so the
 * AI teaches the current book even where the older terms are still on screen.
 */

export const MANUAL_TITLE =
  'The Ultimate Guide to Master the Game - Tour Pure Edition (Dominus Golf, by Jay Moore)';

/** Condensed from the manual. Every line here can be found in the book. */
export const MANUAL_CORE = `The Dominus Golf Blueprint starts where scoring happens and builds outward: putting, then short game, wedges, irons, and woods and driver. Rotation drives the swing; the arms and hands deliver the club; the body is the engine. The manual says lead and trail, not left and right.

Tour Pure is the Dominus Golf swing trainer. It is weighted, so the golfer feels it when the swing gets off track. The letters printed on it, T-O-U-R-P-U-R-E, are the swing checkpoints. The white mark at the centre, 2 inches wide, is the Center Checkpoint: the low point of the swing. It is used two ways: in hand, to build rhythm, and on the ground along the toe line, about 4 inches in front of the feet, letters up, TOUR end toward the target, as a setup and low-point guide. Every Tour Pure comes with a free Pitching & Chipping Distance Guide.

The Rhythm: say TOUR slowly going back, PURE smoothly going through, and hold the finish for a count of three.

The eight checkpoints:
T - tall and ready at address.
O - hands, club and chest move away together; the shoulders start the turn.
U in TOUR - trail elbow folds, hands go up; at 9 o'clock the handle points up and the butt end points down at the target line.
R in TOUR - top of the backswing: the letter for the club sits behind the trail shoulder, no higher than the ear; shoulders about 90 degrees, hips about 45.
P - plant the lead side and turn the belt buckle between the ball and the target; don't throw the arms; the trail elbow drops in front of the trail hip (the slot).
U in PURE - the clubhead travels through the ball; hands 2-3 inches ahead of the clubhead at impact.
R in PURE - release through the gap between P and U, then let the club turn around the lead side.
E - end balanced and hold; chest facing the target.

The Club Map - the letter that sits behind the trail shoulder at the top: T driver; O fairway woods; U in TOUR 2-3 hybrids and driving irons; R in TOUR 4-5 hybrids and 3-5 irons; P 6-7 irons; U in PURE 8-9 irons; R in PURE pitching and gap wedges; E sand and lob wedges.

Shaping with Tour Pure on the ground - the handle shows the path; aim the clubface at the target every time and follow the path. Straight: follow the barrel. Draw: the handle points toward the trail ankle; swing into the Center Checkpoint along the handle, from the inside, and out along the barrel. Fade: flip Tour Pure over so the handle points toward the ball side; swing in along the handle from the outside.

Quick Fixes - rushing the backswing: "Make TOUR slower." Stopping or lunging at the top: "Let TOUR flow into PURE." Throwing the arms at the ball: "Plant and turn." Short backswing: "Finish the word TOUR." Quitting on the shot: "Finish the word PURE."

Weight by shot: putting 50/50 and it never moves; chipping and pitching 60/40 on the lead foot, held; wedge partial swings 55/45 lead at address to about 70/30 through impact; irons 50/50 at address to 70/30 or more on the lead foot at impact; driver 55/45 favouring the trail foot at address, ball off the lead heel, caught on the way up.

Wedge distance: backswings to 7:30, 9:00 and 10:30 on the clock. Pitching swing sizes: quarter swing 30-50 yards, half swing 50-75, three-quarter swing 75-100 - so 70 yards is a half swing, 80 a three-quarter. How far each clock position carries depends on the wedge: the clock table in the Pitching & Chipping Distance Guide gives it per wedge, and the golfer checks their own numbers on Days 29-30 and Day 70. Never give a fixed yardage for a clock position. Putting clock: about 7 o'clock back for 10 feet, 8 o'clock for 30 feet. Speed matters more than line.

The 100 Rule: at least 100 swings or putts every day. Rest days count: 100 slow Tour Pure swings or 100 carpet putts. The pre-shot routine comes before every ball.

The manual's drills, with the setup, reps and standard it gives them. Match the drill to the fault: the Low Point Drill fixes contact (fat, thin, divot in the wrong place), not a slice; path and sequencing problems - slice, over the top, throwing the arms - go to the P checkpoint, the 9 O'Clock to 3 O'Clock Drill and the Tour Pure path setup; tempo problems go to the rhythm and the Quick Fixes.
Tap-In Game - putts of 10 feet or more; a putt that holes or stops within 18 inches (four tees around the cup) scores 1; record points out of putts.
6 Balls - six balls in a triangle below the hole, 1 at 2 ft, 2 at 3 ft, 3 about a foot behind; make all 6 in a row, a miss starts over.
Gate Drill - two tees just wider than the putter head, 6 inches in front of the ball; stroke through without touching them.
Roll It to the Center Checkpoint - Tour Pure on the floor across the target line as a backstop; 10 putts each from 3, 6 and 10 feet; record hits out of 30.
Face Check - hold Tour Pure like a putter; 3 sets of 10 slow strokes, and the barrel stays square.
Ladder Drill - targets at 25, 50, 75 and 100 yards with the gap wedge, one ball each going up, then back down.
Clock Drill - backswings to 7:30, 9:00 and 10:30 with each wedge until each gives a predictable distance.
Turn Check - no club, no ball; Tour Pure across the shoulders, then the belt line; shoulders 90, hips 45, a 2:1 ratio.
9 O'Clock to 3 O'Clock Drill - no ball, slow to moderate speed, one set with Tour Pure in hand then switch to the club; 5 sets of 20; hit 9 o'clock back, trail elbow in front of the trail hip, impact with hands ahead, and 3 o'clock through.
Low Point Drill - Tour Pure along the toe line, no ball, 10 swings; a brush mark inside the Center Checkpoint is a hit; pass 8 of 10 before hitting balls. For the driver, clip a tee pushed in at the checkpoint.

Older terms, and what the manual calls them now: P1 is T; P2 is O; P3 is U in TOUR; P4 is R in TOUR; P5 and P6 are P; P7 is U in PURE; P8 and P9 are R in PURE; P10 is E. The "9-to-3 sequence" is the 9 O'Clock to 3 O'Clock Drill. A "hip bump" is "plant the lead side and turn the belt buckle". The wedge clock is 7:30 / 9:00 / 10:30, not 8:00 / 9:00 / 10:00.`;

/** The on-course subset: what a caddie needs in one breath, not a lesson. */
export const MANUAL_CADDIE_CORE = `From the Dominus Golf manual: the letter for the club sits behind the trail shoulder at the top (T driver, O fairway woods, U in TOUR 2-3 hybrids, R in TOUR 4-5 hybrids and 3-5 irons, P 6-7 irons, U in PURE 8-9 irons, R in PURE pitching and gap wedges, E sand and lob wedges). The rhythm is TOUR slowly back, PURE smoothly through, hold the finish. Wedge swings go to 7:30, 9:00 or 10:30. Course management: play to your strengths and your natural shape, aim for the centre of the green, avoid short-sided misses, and take one more club than you think - most amateurs hit it shorter than they believe. Pre-shot routine every shot: pick an exact target, see the shot, one or two rehearsal swings, one look, commit.`;

// ─── Club letters ────────────────────────────────────────────────────────────

/**
 * The Club Map letter for a club, as the Swing screen labels them. `null` for
 * the putter, which has no letter, and for anything unrecognised.
 */
export function clubLetter(club: string): string | null {
  const c = club.toLowerCase().replace(/[\s-]+/g, '');
  if (c === 'driver') return 'T';
  if (/^\dwood$|wood$/.test(c)) return 'O';
  if (c === 'hybrid') return 'U in TOUR for a 2-3 hybrid, R in TOUR for a 4-5 hybrid';
  const iron = c.match(/^(\d)iron$/);
  if (iron) {
    const n = Number(iron[1]);
    if (n <= 5) return 'R in TOUR';
    if (n <= 7) return 'P';
    return 'U in PURE';
  }
  if (['pw', 'gw', 'pitchingwedge', 'gapwedge'].includes(c)) return 'R in PURE';
  if (['sw', 'lw', 'sandwedge', 'lobwedge'].includes(c)) return 'E';
  return null;
}

/**
 * What the swing analysis judges against: the manual's eight checkpoints,
 * the letter for this club, and the full-swing drills it may prescribe.
 *
 * Kept short - the analysis already spends most of the minute's token
 * allowance on frames (see OPENAI_MAX_FRAMES), and this rides along with them.
 */
export function swingAnalysisGuide(club: string): string {
  const letter = clubLetter(club);
  return `Judge the swing against the Dominus Golf manual's eight checkpoints, T-O-U-R-P-U-R-E:
T - tall and ready at address. O - hands, club and chest move away together. U in TOUR - at 9 o'clock the trail elbow has folded, the handle points up and the butt end points at the target line. R in TOUR - top of the backswing, shoulders about 90 degrees and hips about 45. P - plant the lead side and turn the belt buckle between the ball and the target; the trail elbow drops in front of the trail hip (the slot), the arms are not thrown. U in PURE - impact, hands 2-3 inches ahead of the clubhead, hips open, trail shoulder lower than the lead. R in PURE - the release, the club turning around the lead side. E - a balanced, held finish, chest to the target.${
    letter
      ? `\nFor a ${club}, the manual's Club Map puts ${letter} behind the trail shoulder at the top, no higher than the ear - check that at R in TOUR.`
      : ''
  }
Weight: irons go from 50/50 at address to 70/30 or more on the lead foot at impact; the driver starts 55/45 on the trail foot and catches the ball on the way up.
When a drill fits the fix, prescribe one of the manual's by name with its reps: the Low Point Drill (10 swings, pass 8 of 10), the 9 O'Clock to 3 O'Clock Drill (5 sets of 20, no ball), the Turn Check, or TOUR PURE rhythm swings (say TOUR back, PURE through, hold the finish for three).`;
}

// ─── Search ──────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    'a an and are as at be but by can do does for from get got have how i if in into is it its ' +
    'just keep me my no not of on or so than that the their them then there these they this to ' +
    'up was we what when where which who why will with you your im ive dont cant should would ' +
    'could about any some more most very really much all also out'
  ).split(' '),
);

/**
 * Golfer words to manual words. A golfer says "I keep slicing"; the manual
 * talks about an out-to-in path. Expanding the question is what lets plain
 * keyword scoring find the right section without embeddings.
 */
const SYNONYMS: Record<string, string[]> = {
  slice: ['slice', 'outtoin', 'path', 'downswing', 'hips'],
  slicing: ['slice', 'outtoin', 'path', 'downswing', 'hips'],
  hook: ['draw', 'intoout', 'path', 'clubface'],
  pull: ['outtoin', 'path'],
  push: ['alignment', 'intoout'],
  fat: ['fat', 'low', 'point', 'weight', 'lead'],
  chunk: ['fat', 'low', 'point'],
  thin: ['thin', 'spine', 'angle', 'low', 'point'],
  top: ['thin', 'spine', 'low', 'point'],
  skull: ['thin', 'low', 'point'],
  divot: ['divot', 'low', 'point', 'center', 'checkpoint'],
  putt: ['putting', 'putt', 'putter', 'stroke'],
  putts: ['putting', 'putt', 'lag', 'tapin'],
  putting: ['putting', 'putt', 'stroke'],
  threeputt: ['lag', 'tapin', 'distance', 'speed'],
  lag: ['lag', 'tapin', 'speed', 'distance'],
  read: ['green', 'reading', 'break', 'threeview'],
  break: ['break', 'point', 'green', 'reading'],
  green: ['green', 'putting'],
  chip: ['chipping', 'chip', 'landing'],
  chipping: ['chipping', 'chip', 'landing'],
  pitch: ['pitching', 'pitch', 'swing', 'size'],
  pitching: ['pitching', 'pitch'],
  bunker: ['bunker', 'sand'],
  sand: ['bunker', 'sand'],
  trap: ['bunker', 'sand'],
  wedge: ['wedge', 'wedges', 'clock'],
  wedges: ['wedge', 'wedges', 'clock'],
  distance: ['distance', 'numbers', 'clock'],
  yardage: ['distance', 'numbers', 'yards'],
  driver: ['driver', 'tee', 'ascending'],
  drive: ['driver', 'tee', 'ascending'],
  tee: ['driver', 'tee'],
  wood: ['fairway', 'woods', 'sweep'],
  woods: ['fairway', 'woods', 'sweep'],
  hybrid: ['hybrids', 'hybrid', 'fairway'],
  iron: ['iron', 'irons'],
  irons: ['iron', 'irons'],
  tempo: ['rhythm', 'tour', 'pure'],
  rhythm: ['rhythm', 'tour', 'pure'],
  rushing: ['rhythm', 'quick', 'fixes'],
  grip: ['grip', 'pressure', 'neutral'],
  aim: ['alignment', 'target', 'line'],
  alignment: ['alignment', 'target', 'line'],
  setup: ['setup', 'stance', 'address', 'alignment'],
  stance: ['stance', 'setup', 'weight'],
  posture: ['spine', 'setup', 'posture'],
  weight: ['weight', 'distribution', 'lead', 'trail'],
  nerves: ['mental', 'routine', 'pressure', 'mistakes'],
  pressure: ['mental', 'routine', 'pressure'],
  confidence: ['mental', 'routine', 'commit'],
  angry: ['mistakes', 'mental'],
  routine: ['routine', 'preshot'],
  strategy: ['course', 'management', 'strengths'],
  course: ['course', 'management'],
  practice: ['practice', 'purpose', 'deliberate'],
  practise: ['practice', 'purpose', 'deliberate'],
  program: ['program', 'phase', 'days'],
  plan: ['program', 'phase', 'days'],
  schedule: ['program', 'phase', 'days'],
  trainer: ['tour', 'pure', 'trainer'],
  tourpure: ['tour', 'pure'],
  checkpoint: ['checkpoint', 'checkpoints', 'letter'],
  checkpoints: ['checkpoint', 'checkpoints', 'letter'],
  turn: ['turn', 'rotation', 'shoulders', 'hips'],
  rotation: ['rotation', 'turn', 'hips'],
  shape: ['draw', 'fade', 'shaping', 'path'],
  draw: ['draw', 'intoout', 'shaping'],
  fade: ['fade', 'shaping', 'outtoin'],
  plane: ['plane', 'steep', 'flat'],
  home: ['home', 'carpet', 'floor'],
  indoors: ['home', 'carpet', 'floor'],
  mastery: ['mastery', 'timeline'],
  long: ['timeline', 'days'],
  founder: ['jay', 'moore', 'founder'],
  founded: ['jay', 'moore', 'founder'],
  dominus: ['dominus', 'blueprint'],
  nervous: ['mental', 'routine', 'mistakes', 'commit'],
  anxious: ['mental', 'routine', 'mistakes', 'commit'],
  scared: ['mental', 'routine', 'commit'],
  choke: ['mental', 'pressure', 'routine'],
  letter: ['letter', 'club', 'map', 'backswing', 'shoulder'],
  map: ['club', 'map', 'letter'],
  // Ball flight. "Too high and short" is answered in the book as hanging back.
  high: ['trajectory', 'hang', 'back', 'weight', 'lead'],
  balloon: ['trajectory', 'hang', 'back', 'weight'],
  trajectory: ['trajectory', 'hang', 'back'],
  // Decisions on the course - Chapter 7's course management.
  water: ['course', 'management', 'aggression', 'percentage', 'center', 'green'],
  hazard: ['course', 'management', 'aggression', 'percentage'],
  risk: ['course', 'management', 'aggression', 'percentage', 'risky'],
  risky: ['course', 'management', 'aggression', 'percentage'],
  lay: ['course', 'management', 'percentage'],
  layup: ['course', 'management', 'percentage'],
  safe: ['course', 'management', 'percentage'],
  aggressive: ['course', 'management', 'aggression'],
  decision: ['course', 'management', 'strengths'],
};

/**
 * Phrases rewritten before tokenising, where a golfer's wording and the
 * manual's differ in a way stemming cannot bridge. The older P-numbers are
 * here too: the drill cards still use them, so golfers will ask about them.
 */
const REWRITES: [RegExp, string][] = [
  [/\btop(ping|ped|s)?\s+(the|my|it)\b|\btopping\b|\btopped\b/g, ' thin '],
  [/\bfirst tee\b/g, ' mental routine '],
  [/\bp1\b/g, ' tall address setup '],
  [/\bp2\b/g, ' takeaway shoulders start turn '],
  [/\bp3\b/g, ' 9 oclock trail elbow folds '],
  [/\bp4\b/g, ' top backswing letter trail shoulder '],
  [/\bp[56]\b/g, ' plant lead side belt buckle slot trail elbow '],
  [/\bp7\b/g, ' impact hands ahead '],
  [/\bp[89]\b/g, ' release 3 oclock '],
  [/\bp10\b/g, ' end balanced finish hold '],
  [/\bhip bump\b/g, ' plant lead side belt buckle '],
];

/** Program sections are schedules: the right answer only when asked about the program. */
const PROGRAM_WORDS = /\b(day|days|program|programme|phase|week|weeks|schedule|plan|90)\b/;
const PROGRAM_DAMPING = 0.5;

/** Lower-case word stems. Crude on purpose - it only has to agree with itself. */
function tokens(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/in-to-out/g, 'intoout')
    .replace(/out-to-in/g, 'outtoin')
    .replace(/tap-in/g, 'tapin')
    .replace(/three-putt/g, 'threeputt')
    .replace(/pre-shot/g, 'preshot')
    .replace(/three-view/g, 'threeview')
    .replace(/tour pure/g, 'tour pure tourpure')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return words.map(stem);
}

function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  // A final e goes, so "slice" and "slicing" meet at "slic". A doubled
  // consonant left behind by a stripped suffix is undone ("topping" is "top"),
  // except ll, ss and tt, so "putting" stays with "putt".
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  if (w !== word && w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|tt)$/.test(w)) {
    w = w.slice(0, -1);
  }
  return w;
}

/**
 * The synonym table keyed the way queries are looked up - by stem - with
 * entries that stem alike merged ("putts" and "putting" are both "putt").
 * Keying it by the raw word would silently miss every inflected form.
 */
const SYNONYMS_BY_STEM: Map<string, string[]> = (() => {
  const map = new Map<string, Set<string>>();
  for (const [word, expansions] of Object.entries(SYNONYMS)) {
    const key = stem(word);
    const set = map.get(key) ?? new Set<string>();
    for (const e of expansions) set.add(stem(e));
    map.set(key, set);
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
})();

type IndexedSection = {
  section: ManualSection;
  terms: Map<string, number>;
  length: number;
  /** Days of the 90-day program this section covers, for "day 12" questions. */
  days: [number, number] | null;
};

const TITLE_WEIGHT = 3;

const INDEX: IndexedSection[] = MANUAL_SECTIONS.map((section) => {
  const terms = new Map<string, number>();
  const add = (t: string, w: number) => terms.set(t, (terms.get(t) ?? 0) + w);
  for (const t of tokens(section.text)) add(t, 1);
  for (const t of tokens(section.title)) add(t, TITLE_WEIGHT);
  const range = section.title.match(/Days? (\d+)-(\d+)/);
  return {
    section,
    terms,
    length: [...terms.values()].reduce((a, b) => a + b, 0),
    days: range ? [Number(range[1]), Number(range[2])] : null,
  };
});

const AVG_LENGTH = INDEX.reduce((a, s) => a + s.length, 0) / INDEX.length;

/** Inverse document frequency: a word in every section tells you nothing. */
const IDF = (() => {
  const df = new Map<string, number>();
  for (const s of INDEX) for (const t of s.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = INDEX.length;
  return (t: string) => {
    const d = df.get(t) ?? 0;
    return Math.log(1 + (n - d + 0.5) / (d + 0.5));
  };
})();

export type ManualHit = { section: ManualSection; score: number };

/**
 * The sections of the manual that best answer `query`, best first.
 *
 * BM25 over the question's words plus their manual-vocabulary synonyms. A
 * question that names a program day ("what do I do on day 12?") goes straight
 * to the section covering that day. Sections scoring under a fraction of the
 * best are dropped, so a question with one clear answer gets one section
 * rather than two padded with noise.
 */
export function searchManual(query: string, limit = 3): ManualHit[] {
  // Rewrites apply to the question only: run over the manual they would turn
  // "the top of the backswing" into a thin strike.
  const asked = REWRITES.reduce((q, [pattern, words]) => q.replace(pattern, words), query.toLowerCase());
  const base = tokens(asked);
  if (base.length === 0) return [];
  const aboutProgram = PROGRAM_WORDS.test(asked);

  const weights = new Map<string, number>();
  for (const t of base) {
    weights.set(t, (weights.get(t) ?? 0) + 1);
    for (const st of SYNONYMS_BY_STEM.get(t) ?? []) {
      if (st !== t) weights.set(st, (weights.get(st) ?? 0) + 0.5);
    }
  }

  const dayMatch = asked.match(/\bday\s*(\d{1,2})\b/);
  const day = dayMatch ? Number(dayMatch[1]) : null;

  const k1 = 1.2;
  const b = 0.75;
  const scored = INDEX.map((s) => {
    let score = 0;
    for (const [t, w] of weights) {
      const tf = s.terms.get(t);
      if (!tf) continue;
      const norm = tf + k1 * (1 - b + (b * s.length) / AVG_LENGTH);
      score += w * IDF(t) * ((tf * (k1 + 1)) / norm);
    }
    if (!aboutProgram && s.section.id.startsWith('program-')) score *= PROGRAM_DAMPING;
    if (day !== null && s.days && day >= s.days[0] && day <= s.days[1]) score += 100;
    return { section: s.section, score };
  })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  const floor = scored[0].score * 0.35;
  return scored.filter((h) => h.score >= floor).slice(0, limit);
}

/**
 * Passage budget for a coach reply: about three sections. Every character is
 * paid for on each turn, against gpt-4o's 30k-tokens-a-minute allowance.
 */
export const COACH_PASSAGE_CHARS = 3500;

/** A top score under this means the question named nothing the manual covers. */
const WEAK_MATCH = 3;

/**
 * Only a question that says nothing of its own - "thanks", "hi", "ok" - gets
 * no passages. Anything with a golf word in it is searched.
 */
const SMALL_TALK =
  /^(hi|hey|hello|thanks|thank you|thx|cheers|ok|okay|cool|great|nice|perfect|awesome|got it|sounds good|will do|yes|no|yep|nope)\b[^?]{0,40}$/i;

/** A follow-up this short leans on what it follows, whatever its own words match. */
const FOLLOW_UP_MAX_TOKENS = 5;

/**
 * Passages for a chat question.
 *
 * Asked in order, stopping at the first that matches the manual well:
 *
 *   1. the question alone - a specific question is left alone, so someone
 *      working on putting who asks about their slice gets the slice;
 *   2. with `earlier`, the golfer's previous questions, newest first - a
 *      follow-up ("how many reps?", "and with my irons?") names nothing on its
 *      own and is only answerable from what it follows;
 *   3. with `phase`, which is what the coach would reach for anyway when the
 *      question is vague ("what should I work on today?").
 *
 * Small talk gets nothing: a manual passage stapled to "thanks" invites the
 * model to lecture.
 */
export function manualForQuestion(
  question: string,
  phase: string,
  earlier: string[] = [],
  maxChars = COACH_PASSAGE_CHARS,
): string {
  if (SMALL_TALK.test(question.trim())) return '';

  // "How many reps should I do?" matches the mastery timeline on "reps" alone,
  // and strongly - but it is asking about the drill just discussed. A short
  // question with history behind it is never searched on its own words.
  const followUp = earlier.length > 0 && tokens(question).length <= FOLLOW_UP_MAX_TOKENS;
  const attempts = [
    ...(followUp ? [] : [question]),
    ...earlier.map((_, i) => [question, ...earlier.slice(0, i + 1)].join(' ')),
    [question, ...earlier.slice(0, 1), phase].join(' '),
  ];
  for (const query of attempts) {
    const top = searchManual(query, 1)[0];
    if (top && top.score >= WEAK_MATCH) return manualExcerpts(query, maxChars);
  }
  return manualExcerpts(attempts[attempts.length - 1], maxChars);
}

/**
 * Relevant sections as prompt text, within a character budget. Whole
 * sections only - half a drill is worse than none - so a long one that does
 * not fit is skipped in favour of the next that does.
 */
export function manualExcerpts(query: string, maxChars = 5000, limit = 3): string {
  const out: string[] = [];
  let used = 0;
  for (const { section } of searchManual(query, limit)) {
    const block = `[${section.chapter} - ${section.title}]\n${section.text}`;
    if (used + block.length > maxChars) continue;
    out.push(block);
    used += block.length;
  }
  return out.join('\n\n');
}
