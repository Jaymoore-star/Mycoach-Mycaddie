import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, type GenericId, v } from 'convex/values';

import { components } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { type MutationCtx, mutation, query } from './_generated/server';
import { swingAnalysisTarget } from './lib/reports';

/**
 * Reporting what the AI said.
 *
 * Google Play's AI-generated content policy requires a way for users to flag
 * offensive output from inside the app. The coach's chat replies and the swing
 * analysis are the two places the app shows model-written text to a golfer.
 *
 * The spoken caddie's answers on the round screen are the third.
 *
 * Reports on stored content check that the golfer is reporting something they
 * were shown. A report copies the text into `contentReports`, so without that
 * check anyone could read another golfer's conversation by reporting its
 * message ids.
 *
 * Two limits keep the table a list of problems rather than a list of taps: one
 * report per golfer per response - a second tap is acknowledged, not stored -
 * and a daily cap, because the caddie report carries text the device supplies
 * and could otherwise be used to fill the table.
 */

/** Harmful or offensive, or wrong or misleading - the two the app offers. */
const reasonValidator = v.union(v.literal('harmful'), v.literal('inaccurate'));

/** Long enough for any single reply; a report is a record, not an archive. */
const MAX_REPORTED_CHARS = 8000;

/** Far more than anyone reading honestly would file in a day. */
export const MAX_REPORTS_PER_DAY = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Stores a report, unless this golfer has already reported this response.
 *
 * Returns whether it was a repeat, so the screen can say so rather than
 * thanking them twice for the same thing.
 */
async function file(
  ctx: MutationCtx,
  report: {
    userId: Id<'users'>;
    kind: 'coach_message' | 'swing_analysis' | 'caddie_answer';
    targetId: string;
    content: string;
    reason: 'harmful' | 'inaccurate';
  },
): Promise<{ alreadyReported: boolean }> {
  const existing = await ctx.db
    .query('contentReports')
    .withIndex('by_user_and_target', (q) =>
      q.eq('userId', report.userId).eq('targetId', report.targetId),
    )
    .first();
  if (existing) return { alreadyReported: true };

  const now = Date.now();
  const today = await ctx.db
    .query('contentReports')
    .withIndex('by_user_and_created', (q) =>
      q.eq('userId', report.userId).gt('createdAt', now - DAY_MS),
    )
    .take(MAX_REPORTS_PER_DAY);
  if (today.length >= MAX_REPORTS_PER_DAY) {
    throw new ConvexError({
      message: 'You have sent a lot of reports today - please try again tomorrow.',
      code: 'RATE_LIMITED',
    });
  }

  await ctx.db.insert('contentReports', {
    ...report,
    content: report.content.slice(0, MAX_REPORTED_CHARS),
    createdAt: now,
  });
  return { alreadyReported: false };
}

/** A stable id for text that has none of its own. */
async function fingerprint(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function requireUser(ctx: MutationCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ message: 'Not signed in', code: 'UNAUTHENTICATED' });
  }
  return userId;
}

/**
 * What the signed-in golfer has already reported, so the screens can show
 * "Reported" instead of asking again. Bounded: the daily cap means this covers
 * about a week of the heaviest use, and anything older is still caught by the
 * duplicate check in `file`.
 */
export const myReportedTargets = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const recent = await ctx.db
      .query('contentReports')
      .withIndex('by_user_and_created', (q) => q.eq('userId', userId))
      .order('desc')
      .take(200);
    return recent.flatMap((r) => (r.targetId ? [r.targetId] : []));
  },
});

export const reportCoachMessage = mutation({
  args: {
    profileId: v.id('golferProfiles'),
    /** The agent component's message id - the chat screen's row key. */
    messageId: v.string(),
    reason: reasonValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const notFound = new ConvexError({ message: 'Message not found', code: 'NOT_FOUND' });

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.userId !== userId) throw notFound;

    // Every coach this golfer has talked to, not only the current one: a
    // golfer can report a reply, switch coach, and the report still stands.
    const threads = await ctx.db
      .query('coachThreads')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .take(10);
    const owned = new Set(threads.map((t) => t.threadId));

    // The id belongs to the component's own table, which this app's data
    // model knows nothing of. A string that is not one of its ids fails the
    // component's validator, and reads as not found rather than a crash.
    const message = await ctx
      .runQuery(components.agent.messages.getMessagesByIds, {
        messageIds: [args.messageId as GenericId<'messages'>],
      })
      .then(([m]) => m)
      .catch(() => null);
    // Only the coach's words are reportable - the golfer's own are theirs.
    if (!message || !owned.has(message.threadId) || message.message?.role !== 'assistant') {
      throw notFound;
    }

    return await file(ctx, {
      userId,
      kind: 'coach_message',
      targetId: args.messageId,
      content: message.text ?? '',
      reason: args.reason,
    });
  },
});

export const reportSwingAnalysis = mutation({
  args: {
    videoId: v.id('swingVideos'),
    reason: reasonValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const video = await ctx.db.get(args.videoId);
    if (!video || video.userId !== userId || !video.aiFeedback) {
      throw new ConvexError({ message: 'Analysis not found', code: 'NOT_FOUND' });
    }

    const f = video.aiFeedback;
    const content = [
      f.summary,
      ...(f.observations ?? []).map((o) => `${o.position}: ${o.detail}`),
      ...f.strengths.map((s) => `+ ${s}`),
      ...f.improvements.map((s) => `- ${s}`),
      ...f.drills.map((s) => `Drill: ${s}`),
    ].join('\n');

    return await file(ctx, {
      userId,
      kind: 'swing_analysis',
      targetId: swingAnalysisTarget(args.videoId, f.analyzedAt),
      content,
      reason: args.reason,
    });
  },
});

/**
 * A caddie answer is returned to the device and never stored, so the device
 * sends back what it showed. Nothing reads another golfer's data this way -
 * the only text involved is what the caller already has. With no id of its
 * own, the answer is identified by a hash of the exchange.
 */
export const reportCaddieAnswer = mutation({
  args: {
    question: v.string(),
    answer: v.string(),
    reason: reasonValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const answer = args.answer.trim();
    if (answer.length === 0) {
      throw new ConvexError({ message: 'Nothing to report', code: 'BAD_REQUEST' });
    }

    const content = `Q: ${args.question.trim()}\nA: ${answer}`;
    return await file(ctx, {
      userId,
      kind: 'caddie_answer',
      targetId: `caddie:${await fingerprint(content)}`,
      content,
      reason: args.reason,
    });
  },
});
