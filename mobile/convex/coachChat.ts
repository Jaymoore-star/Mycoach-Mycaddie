import { openai } from '@ai-sdk/openai';
import { Agent } from '@convex-dev/agent';
import { getAuthUserId } from '@convex-dev/auth/server';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  type MutationCtx,
  type QueryCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { extractTendencies } from './lib/caddie';
import { buildCoachSystemPrompt, type PlayerSnapshot } from './lib/coachContext';
import { DEFAULT_COACH_ID, type CoachId } from './lib/coachLevels';
import { getCoachProfile } from './lib/coachPersona';
import { SKILL_LABELS } from './lib/curriculum';
import { handicapIndex, scoreDifferential } from './lib/handicap';

/**
 * Conversational coaching.
 *
 * Message storage, ordering and pagination belong to the `@convex-dev/agent`
 * component (mounted in `convex.config.ts`). Everything here is the layer
 * around it: ownership, the persona, and the briefing of the golfer's real
 * data that each reply is grounded in.
 *
 * The client never sees or sends a `threadId` - only a `profileId`, which is
 * checked against the signed-in user before a thread is resolved. Ids arrive
 * from the client, so a valid id is not permission.
 */

/** Chat is text-only and short-turn, so the cheap fast model is the right one. */
const DEFAULT_CHAT_MODEL = 'gpt-4o';

/**
 * How much conversation goes back to the model each turn.
 *
 * The system briefing alone is ~600-900 tokens, and the account's allowance is
 * 30k tokens per minute (see OPENAI_MAX_FRAMES in swingVideos.ts for the same
 * constraint). Twenty messages keeps a long session comfortably inside it
 * while still remembering the thread of the conversation.
 */
const RECENT_MESSAGES = 20;

/** Long enough to describe a miss in detail, short enough to bound the cost. */
const MAX_PROMPT_CHARS = 2000;

/**
 * How often the half-written reply is flushed to the database.
 *
 * Every flush is a write and a re-render on the device, so the model's own
 * token rate is far too fast to follow directly. These two together give
 * roughly six updates a second on a fast reply, which reads as writing rather
 * than as either a stutter or a jump.
 */
const STREAM_FLUSH_MS = 150;
const STREAM_FLUSH_CHARS = 24;

const coachAgent = new Agent(components.agent, {
  name: 'Dominus Coach',
  languageModel: openai.chat(process.env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
});

const coachIdValidator = v.union(
  v.literal('que'),
  v.literal('mason'),
  v.literal('sam'),
  v.literal('dom'),
);

async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/** The coach a profile talks to. Unset profiles fall back to level 1. */
function coachIdFor(profile: Doc<'golferProfiles'>): CoachId {
  return profile.coachId ?? DEFAULT_COACH_ID;
}

async function findThread(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<'golferProfiles'>,
  coachId: CoachId,
) {
  return await ctx.db
    .query('coachThreads')
    .withIndex('by_profile_and_coach', (q) =>
      q.eq('profileId', profileId).eq('coachId', coachId),
    )
    .unique();
}

// ─── Reading the conversation ────────────────────────────────────────────────

/**
 * One page of the conversation with the profile's current coach.
 *
 * Returns an empty page rather than throwing when there is no thread yet, so
 * the screen renders its empty state on first open instead of an error.
 */
export const listMessages = query({
  args: {
    profileId: v.id('golferProfiles'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const empty = { page: [], isDone: true, continueCursor: '' };

    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return empty;

    const thread = await findThread(ctx, args.profileId, coachIdFor(owned.profile));
    if (!thread) return empty;

    return await coachAgent.listMessages(ctx, {
      threadId: thread.threadId,
      paginationOpts: args.paginationOpts,
      excludeToolMessages: true,
    });
  },
});

// ─── Sending ─────────────────────────────────────────────────────────────────

/**
 * Saves the golfer's message and schedules the reply.
 *
 * Split into a mutation plus a scheduled action deliberately: the message is
 * durably stored the instant it is sent, so the reply survives the app being
 * backgrounded mid-generation and the UI has something to render immediately.
 */
export const sendMessage = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) {
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }

    const prompt = args.prompt.trim();
    if (prompt.length === 0) {
      throw new ConvexError({ message: 'Message is empty', code: 'BAD_REQUEST' });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new ConvexError({
        message: `Keep it under ${MAX_PROMPT_CHARS} characters so your coach can answer properly`,
        code: 'BAD_REQUEST',
      });
    }

    const coachId = coachIdFor(owned.profile);

    let thread = await findThread(ctx, args.profileId, coachId);
    if (!thread) {
      const { threadId } = await coachAgent.createThread(ctx, {
        userId: owned.userId,
        title: `${getCoachProfile(coachId).name} and ${owned.profile.displayName}`,
      });
      const rowId = await ctx.db.insert('coachThreads', {
        userId: owned.userId,
        profileId: args.profileId,
        coachId,
        threadId,
      });
      thread = (await ctx.db.get(rowId))!;
    }

    // Embeddings need `fetch`, which a mutation cannot do. Nothing here uses
    // vector search over history, so they are skipped rather than deferred.
    const { messageId } = await coachAgent.saveMessage(ctx, {
      threadId: thread.threadId,
      userId: owned.userId,
      prompt,
      skipEmbeddings: true,
    });

    await ctx.scheduler.runAfter(0, internal.coachChat.generateReply, {
      threadId: thread.threadId,
      promptMessageId: messageId,
      profileId: args.profileId,
      coachId,
    });

    return null;
  },
});

/** Wipes the conversation with the current coach and starts fresh. */
export const clearConversation = mutation({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) {
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }

    const thread = await findThread(ctx, args.profileId, coachIdFor(owned.profile));
    if (!thread) return null;

    // A reply may be mid-flight; its draft would otherwise survive the wipe
    // and reappear under an empty conversation.
    const draft = await ctx.db
      .query('coachDrafts')
      .withIndex('by_thread', (q) => q.eq('threadId', thread.threadId))
      .unique();
    if (draft) await ctx.db.delete(draft._id);

    // Row first: once it is gone the thread is unreachable, so a failure to
    // schedule the component's cleanup cannot leave a conversation half-shown.
    await ctx.db.delete(thread._id);
    await coachAgent.deleteThreadAsync(ctx, { threadId: thread.threadId });

    return null;
  },
});

// ─── The briefing ────────────────────────────────────────────────────────────

/**
 * Everything the coach is allowed to know about this golfer.
 *
 * Assembled in one transaction so the numbers in a single reply cannot come
 * from two different moments. Reads are bounded - the coach needs the recent
 * shape of things, not the full history.
 */
export const getChatContext = internalQuery({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args): Promise<PlayerSnapshot | null> => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) return null;

    const [rounds, sessions, skillTests, shots, swings] = await Promise.all([
      ctx.db
        .query('roundScores')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(20),
      ctx.db
        .query('trainingSessions')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(5),
      ctx.db
        .query('skillsTests')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(1),
      ctx.db
        .query('shotLogs')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(100),
      ctx.db
        .query('swingVideos')
        .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
        .order('desc')
        .take(5),
    ]);

    // Same WHS rules the Handicap screen uses: 18 holes with rating and slope,
    // or there is no valid differential to average.
    const eligible = rounds
      .filter((r) => r.holes.length >= 18 && r.courseRating && r.courseSlope)
      .slice(0, 20);
    const index = handicapIndex(
      eligible.map((r) => scoreDifferential(r.totalScore, r.courseRating!, r.courseSlope!)),
    );

    const latestSwing = swings.find((s) => s.aiFeedback) ?? null;

    // A round that was started and abandoned sits in the table with no holes
    // and a score of 0. Handed to the coach it reads as a 72-under round, so
    // only rounds with holes actually logged reach the briefing.
    const played = rounds.filter((r) => r.holes.length > 0);

    const clubCarries = Object.entries(profile.clubDistances ?? {})
      .map(([club, d]) => ({ club, carry: d.carry }))
      .sort((a, b) => b.carry - a.carry);

    return {
      displayName: profile.displayName,
      skillLevel: profile.skillLevel,
      skillLabel: SKILL_LABELS[profile.skillLevel],
      handicapIndex: index,
      currentDay: profile.currentDay,
      currentPhase: profile.currentPhase,
      targetScore: profile.targetScore,
      scoringAvg: profile.scoringAvg ?? null,
      weeklyGoal: profile.weeklyGoal ?? null,
      tourPureActive: profile.tourPureActive ?? false,
      recentRounds: played.slice(0, 5).map((r) => ({
        // Rounds store a full ISO timestamp; the coach only needs the day.
        date: r.date.slice(0, 10),
        courseName: r.courseName,
        totalScore: r.totalScore,
        totalPar: r.totalPar,
        putts: r.holes.reduce((sum, h) => sum + h.putts, 0),
        holesPlayed: r.holes.length,
        fairwaysHit: r.holes.some((h) => h.fairwayHit !== undefined)
          ? r.holes.filter((h) => h.fairwayHit).length
          : null,
        greensHit: r.holes.some((h) => h.girHit !== undefined)
          ? r.holes.filter((h) => h.girHit).length
          : null,
      })),
      recentSessions: sessions.map((s) => ({
        date: s.date.slice(0, 10),
        day: s.day,
        phase: s.phase,
        tasksCompleted: s.tasksCompleted.length,
        tasksTotal: s.tasksTotal,
        complete: s.sessionComplete,
      })),
      latestSkillTest: skillTests[0]
        ? {
            date: skillTests[0].date.slice(0, 10),
            phase: skillTests[0].phase,
            weekNumber: skillTests[0].weekNumber,
            score: skillTests[0].score,
            overallPass: skillTests[0].overallPass,
          }
        : null,
      tendencies:
        shots.length > 0
          ? extractTendencies(
              shots.map((s) => ({
                club: s.club,
                missDirection: s.missDirection ?? null,
                distanceFromTargetYards: s.distanceFromTargetYards,
                shotShape: s.shotShape,
              })),
            )
          : null,
      latestSwing:
        latestSwing && latestSwing.aiFeedback
          ? {
              label: latestSwing.label,
              recordedAt: latestSwing.recordedAt.slice(0, 10),
              summary: latestSwing.aiFeedback.summary,
              improvements: latestSwing.aiFeedback.improvements,
              basis: latestSwing.aiFeedback.basis ?? null,
            }
          : null,
      clubCarries,
    };
  },
});

// ─── The reply as it is being written ────────────────────────────────────────

export const startDraft = internalMutation({
  args: { threadId: v.string(), profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('coachDrafts')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .unique();

    // A draft left behind by an earlier failed generation would otherwise show
    // up under the new question.
    if (existing) await ctx.db.delete(existing._id);

    await ctx.db.insert('coachDrafts', {
      threadId: args.threadId,
      profileId: args.profileId,
      text: '',
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const updateDraft = internalMutation({
  args: { threadId: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const draft = await ctx.db
      .query('coachDrafts')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .unique();
    // Cleared mid-stream (the conversation was wiped) - nothing to write into.
    if (!draft) return null;

    await ctx.db.patch(draft._id, { text: args.text, updatedAt: Date.now() });
    return null;
  },
});

export const clearDraft = internalMutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const draft = await ctx.db
      .query('coachDrafts')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .unique();
    if (draft) await ctx.db.delete(draft._id);
    return null;
  },
});

/**
 * The reply currently being written, if there is one.
 *
 * Separate from `listMessages` on purpose: that query is paginated and its
 * pages would be invalidated on every token. This one is a single row, so the
 * device re-renders one bubble rather than re-fetching the conversation six
 * times a second.
 *
 * `null` means nothing is being written. A row with empty text means the
 * request is away but no words have come back yet, which is what the thinking
 * indicator is for.
 */
export const streamingReply = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args): Promise<{ text: string } | null> => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return null;

    const thread = await findThread(ctx, args.profileId, coachIdFor(owned.profile));
    if (!thread) return null;

    const draft = await ctx.db
      .query('coachDrafts')
      .withIndex('by_thread', (q) => q.eq('threadId', thread.threadId))
      .unique();

    return draft ? { text: draft.text } : null;
  },
});

/** A visible reply when generation fails, so the screen is never left silent. */
export const saveFailureNotice = internalAction({
  args: { threadId: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    await coachAgent.saveMessage(ctx, {
      threadId: args.threadId,
      message: { role: 'assistant', content: args.text },
      skipEmbeddings: true,
    });
    return null;
  },
});

// ─── Generating the reply ────────────────────────────────────────────────────

export const generateReply = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    profileId: v.id('golferProfiles'),
    coachId: coachIdValidator,
  },
  handler: async (ctx, args): Promise<null> => {
    if (!process.env.OPENAI_API_KEY) {
      await ctx.runAction(internal.coachChat.saveFailureNotice, {
        threadId: args.threadId,
        text: 'Coaching chat is not configured on this deployment yet.',
      });
      return null;
    }

    const snapshot = await ctx.runQuery(internal.coachChat.getChatContext, {
      profileId: args.profileId,
    });
    if (!snapshot) return null;

    // "Has data" gates the whole briefing: a golfer on day 1 with nothing
    // logged should get a coach who asks about their game, not one reciting
    // a page of zeroes back at them.
    const hasData =
      snapshot.recentRounds.length > 0 ||
      snapshot.recentSessions.length > 0 ||
      snapshot.tendencies !== null ||
      snapshot.latestSwing !== null;

    const system = buildCoachSystemPrompt(
      getCoachProfile(args.coachId),
      snapshot,
      hasData,
    );

    // Opened before the request so the screen has something to show from the
    // first frame, rather than after the model's first token.
    await ctx.runMutation(internal.coachChat.startDraft, {
      threadId: args.threadId,
      profileId: args.profileId,
    });

    try {
      const result = await coachAgent.streamText(
        ctx,
        { threadId: args.threadId },
        { promptMessageId: args.promptMessageId, system, temperature: 0.7 },
        { contextOptions: { recentMessages: RECENT_MESSAGES, excludeToolMessages: true } },
      );

      // Deltas are not saved through the component: that would need
      // `@convex-dev/agent/react` on the device to reassemble them, and that
      // entry point pulls `ai` and `@ai-sdk/provider-utils` into the Metro
      // bundle - the thing rule 2 in PLAN.md exists to prevent. Writing the
      // running text into one row instead keeps the client on plain
      // `useQuery`, and the app bundle free of the AI SDK.
      let text = '';
      let flushedAt = 0;
      let flushedLength = 0;

      for await (const chunk of result.textStream) {
        text += chunk;

        const now = Date.now();
        if (
          now - flushedAt >= STREAM_FLUSH_MS &&
          text.length - flushedLength >= STREAM_FLUSH_CHARS
        ) {
          flushedAt = now;
          flushedLength = text.length;
          await ctx.runMutation(internal.coachChat.updateDraft, {
            threadId: args.threadId,
            text,
          });
        }
      }

      // Draining the stream is what makes the agent store the finished
      // message. Without it a reply the golfer watched being written would
      // vanish when the draft is cleared.
      await result.consumeStream();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[coachChat.generateReply]', message);

      await ctx.runAction(internal.coachChat.saveFailureNotice, {
        threadId: args.threadId,
        // Rate limiting is the one failure the golfer can actually act on, so
        // it does not get flattened into the generic retry message.
        text: /rate limit|429/i.test(message)
          ? 'Your coach is over the account rate limit right now - give it a minute and ask again.'
          : 'Your coach could not answer that one - please try again.',
      });
    } finally {
      // Always last, and always runs: the saved message has landed by now, so
      // dropping the draft hands the bubble over without a gap. A draft left
      // behind would sit under the conversation forever.
      await ctx.runMutation(internal.coachChat.clearDraft, { threadId: args.threadId });
    }

    return null;
  },
});
