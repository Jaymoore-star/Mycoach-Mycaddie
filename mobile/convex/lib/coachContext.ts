/**
 * Turns a golfer's real data into the system prompt their coach answers from.
 *
 * Pure on purpose. The Convex action reads the tables and hands the result
 * here, so what the model is told can be asserted in tests rather than
 * inspected by reading replies. Everything the coach claims to know about the
 * golfer has to appear in this string - see `coachChat.ts` for the rule that
 * it must not invent the rest.
 */
import type { TendencyProfile } from './caddie';
import type { CoachProfile } from './coachPersona';
import { PHASES } from './curriculum';
import type { Phase, SkillLevel } from './curriculum';
import { PROGRAM_DAYS } from './program';

export type RoundSummary = {
  date: string;
  courseName: string;
  totalScore: number;
  totalPar: number;
  putts: number;
  holesPlayed: number;
  fairwaysHit: number | null;
  greensHit: number | null;
};

export type SessionSummary = {
  date: string;
  day: number;
  phase: string;
  tasksCompleted: number;
  tasksTotal: number;
  complete: boolean;
};

export type SkillTestSummary = {
  date: string;
  phase: string;
  weekNumber: number;
  score: number;
  overallPass: boolean;
};

export type SwingSummary = {
  label: string;
  recordedAt: string;
  summary: string;
  improvements: string[];
  /** 'video' when the model read frames, 'club' when it was generic advice. */
  basis: 'video' | 'club' | null;
};

export type PlayerSnapshot = {
  displayName: string;
  skillLevel: SkillLevel;
  skillLabel: string;
  handicapIndex: number | null;
  currentDay: number;
  currentPhase: Phase;
  targetScore: number;
  scoringAvg: number | null;
  weeklyGoal: number | null;
  tourPureActive: boolean;
  /** Newest first. */
  recentRounds: RoundSummary[];
  /** Newest first. */
  recentSessions: SessionSummary[];
  latestSkillTest: SkillTestSummary | null;
  tendencies: TendencyProfile | null;
  latestSwing: SwingSummary | null;
  /** Carry yardages the golfer has on file, longest club first. */
  clubCarries: { club: string; carry: number }[];
};

const MISS_WORDS: Record<string, string> = {
  left: 'misses left',
  right: 'misses right',
  short: 'comes up short',
  long: 'flies the target',
  center: 'centres the target',
};

function scoreToPar(score: number, par: number) {
  const diff = score - par;
  if (diff === 0) return 'level par';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/**
 * The golfer's data as prose.
 *
 * Bullets, not JSON: the model reads this as briefing notes and quotes the
 * numbers back naturally. Empty sections are omitted entirely rather than
 * rendered as "none", so the coach is never handed a wall of blanks to
 * apologise for.
 */
export function formatPlayerContext(snapshot: PlayerSnapshot): string {
  const lines: string[] = [];

  lines.push(`Name: ${snapshot.displayName}`);
  lines.push(`Self-rated level: ${snapshot.skillLabel}`);
  lines.push(
    snapshot.handicapIndex === null
      ? 'Handicap Index: not established yet (needs more scored rounds)'
      : `Handicap Index: ${snapshot.handicapIndex.toFixed(1)}`,
  );
  lines.push(
    `90-Day Program: day ${snapshot.currentDay} of ${PROGRAM_DAYS}, ` +
      `in the ${PHASES[snapshot.currentPhase].label} phase`,
  );
  lines.push(`Target score: ${snapshot.targetScore}`);
  if (snapshot.scoringAvg !== null) {
    lines.push(`Scoring average on file: ${snapshot.scoringAvg}`);
  }
  if (snapshot.weeklyGoal !== null) {
    lines.push(`Weekly practice goal: ${snapshot.weeklyGoal} sessions`);
  }
  if (snapshot.tourPureActive) {
    lines.push('Practising with the Tour Pure Training System, not standard clubs.');
  }

  if (snapshot.recentRounds.length > 0) {
    lines.push('');
    lines.push('Recent rounds (newest first):');
    for (const r of snapshot.recentRounds) {
      const parts = [
        `${r.date} ${r.courseName}`,
        `${r.totalScore} (${scoreToPar(r.totalScore, r.totalPar)})`,
        `${r.putts} putts`,
      ];
      if (r.holesPlayed < 18) parts.push(`${r.holesPlayed} holes`);
      if (r.fairwaysHit !== null) parts.push(`${r.fairwaysHit} fairways`);
      if (r.greensHit !== null) parts.push(`${r.greensHit} greens`);
      lines.push(`- ${parts.join(', ')}`);
    }
  }

  if (snapshot.recentSessions.length > 0) {
    lines.push('');
    lines.push('Recent practice sessions (newest first):');
    for (const s of snapshot.recentSessions) {
      lines.push(
        `- ${s.date}, day ${s.day} (${s.phase}): ${s.tasksCompleted}/${s.tasksTotal} drills` +
          `${s.complete ? ', completed' : ', left unfinished'}`,
      );
    }
  }

  if (snapshot.latestSkillTest) {
    const t = snapshot.latestSkillTest;
    lines.push('');
    lines.push(
      `Last skills test: ${t.date}, week ${t.weekNumber} (${t.phase}), ` +
        `scored ${t.score}/100 - ${t.overallPass ? 'passed' : 'did not pass'}`,
    );
  }

  const tend = snapshot.tendencies;
  if (tend && (tend.dominantMiss || tend.commonClubs.length > 0)) {
    lines.push('');
    lines.push('Ball-flight tendencies from logged shots:');
    if (tend.dominantMiss) {
      lines.push(
        `- Dominant miss: ${MISS_WORDS[tend.dominantMiss] ?? tend.dominantMiss}` +
          (tend.avgMissYards > 0 ? `, averaging ${tend.avgMissYards} yards off target` : ''),
      );
    }
    if (tend.favoriteShape) lines.push(`- Natural shape: ${tend.favoriteShape}`);
    if (tend.commonClubs.length > 0) {
      lines.push(`- Most-used clubs: ${tend.commonClubs.join(', ')}`);
    }
    if (tend.weaknesses.length > 0) {
      lines.push(`- Least accurate clubs: ${tend.weaknesses.join(', ')}`);
    }
  }

  if (snapshot.clubCarries.length > 0) {
    lines.push('');
    lines.push(
      'Carry distances on file: ' +
        snapshot.clubCarries.map((c) => `${c.club} ${c.carry}y`).join(', '),
    );
  }

  if (snapshot.latestSwing) {
    const s = snapshot.latestSwing;
    lines.push('');
    lines.push(`Most recent swing recording: ${s.label}, ${s.recordedAt}.`);
    if (s.basis === 'video') {
      lines.push(`What the analysis read from the video: ${s.summary}`);
      if (s.improvements.length > 0) {
        lines.push(`Fixes it flagged: ${s.improvements.join('; ')}`);
      }
    } else if (s.basis === 'club') {
      lines.push(
        'That recording has only club-level notes - no frames were read, ' +
          'so do not describe what their swing looked like.',
      );
    }
  }

  return lines.join('\n');
}

/**
 * The full system prompt: who the coach is, what they know, and what they are
 * not allowed to do.
 *
 * The honesty rules are last because they are the ones that must survive a
 * long conversation, and the level guardrail is stated as the coach's own
 * teaching philosophy rather than a restriction - a coach who says "that is
 * two levels ahead of where you are, here is what comes first" reads as
 * coaching, while one who says "I am not allowed to discuss that" reads as a
 * broken product.
 */
export function buildCoachSystemPrompt(
  coach: CoachProfile,
  snapshot: PlayerSnapshot,
  hasData: boolean,
): string {
  const spec = coach.levelSpec;

  return `You are ${coach.name}, the ${coach.title} in the Dominus Golf academy - a real
coach having a conversation with your student, not a chatbot. Speak in first person.

Your background: ${coach.bio}
Your style: ${coach.coachingStyle}. Your students know you for: "${coach.tagline}"

You teach exactly one level of this system: ${spec.subtitle} (${spec.breakingScore}).
Your objective for this student: ${spec.coreObjective}

What you drill:
${spec.trainingFocus.map((f) => `- ${f}`).join('\n')}

Your vocabulary - use these terms naturally, they are how you teach:
${spec.keyVocabulary.join(', ')}

Graduating your level looks like: ${spec.scoringBenchmark}

You deliberately do not teach these yet: ${spec.avoidKeywords.join(', ')}.
If the student asks about one, do not refuse and do not pretend it is unimportant.
Tell them plainly that it comes after what they are working on now, say what has to be
solid first, and give them that instead.

# What you know about this student

${hasData ? formatPlayerContext(snapshot) : `Name: ${snapshot.displayName}\nThey have not logged any rounds, practice sessions or shots yet.`}

# How you answer

- Talk like a coach on the range: direct, warm, specific. Two or three short paragraphs
  at most, or a short list when you are giving steps.
- Write plain sentences, not formatted text. No markdown of any kind: no **bold**, no
  headings, no tables, no code fences. Your words are read in a chat bubble and spoken
  aloud, and in both places a stray asterisk is just noise.
- Lead with the answer. Diagnose, then prescribe one thing to work on - not five.
- When you give a drill, give the setup, the rep count and what "good" feels like.
- Use their numbers when they are relevant. Referring to a specific round or a logged
  miss is what makes you their coach rather than a search result.
- Ask a follow-up question only when you genuinely cannot diagnose without it.

# What you must not do

- Never state a number about this student that is not in the briefing above. No invented
  clubhead speeds, carry distances, handicaps, scores or launch numbers. If you need one
  you do not have, ask for it.
- Never claim to have watched a swing. You cannot see video here. If their recording was
  analysed, the findings are in the briefing and you may refer to those - otherwise say
  you would need to see it.
- Never diagnose an injury or give medical advice. Point them to a professional.
- If you do not know, say so. A student can act on "I would need to see your divot
  pattern"; they cannot act on a confident guess.`;
}
