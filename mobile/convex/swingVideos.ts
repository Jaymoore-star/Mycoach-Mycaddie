import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  type MutationCtx,
  type QueryCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';

async function ownedProfile(ctx: QueryCtx | MutationCtx, profileId: Id<'golferProfiles'>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile || profile.userId !== userId) return null;

  return { userId, profile };
}

/** Short-lived upload URL for the recorded file. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

const recordingArgs = {
  storageId: v.id('_storage'),
  profileId: v.id('golferProfiles'),
  label: v.string(),
  notes: v.optional(v.string()),
  durationSeconds: v.number(),
  recordedAt: v.string(),
  // Stills in swing order, extracted on-device at capture time.
  frameStorageIds: v.optional(v.array(v.id('_storage'))),
};

/** True when the signed-in caller owns this profile. */
export const ownsProfile = internalQuery({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => (await ownedProfile(ctx, args.profileId)) !== null,
});

/**
 * Drops an upload that was rejected, so it is not billable forever while being
 * reachable by nothing.
 */
export const discardUpload = internalMutation({
  args: {
    storageId: v.id('_storage'),
    frameStorageIds: v.optional(v.array(v.id('_storage'))),
  },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId).catch(() => undefined);
    for (const frameId of args.frameStorageIds ?? []) {
      await ctx.storage.delete(frameId).catch(() => undefined);
    }
  },
});

/** The write itself. Re-checks ownership: this is the transaction that counts. */
export const insertRecording = internalMutation({
  args: recordingArgs,
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) {
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }

    return await ctx.db.insert('swingVideos', {
      userId: owned.userId,
      profileId: args.profileId,
      storageId: args.storageId,
      label: args.label,
      notes: args.notes,
      durationSeconds: args.durationSeconds,
      recordedAt: args.recordedAt,
      frameStorageIds: args.frameStorageIds,
    });
  },
});

/**
 * Records the metadata once the file itself is in storage.
 *
 * An action rather than a mutation, because rejecting an upload has to both
 * delete the orphaned files *and* fail. A mutation is a single transaction, so
 * throwing rolls the deletes back with everything else and the files survive -
 * which is exactly what this used to do. Three separate transactions: check,
 * clean up, then throw.
 */
export const saveRecording = action({
  args: recordingArgs,
  handler: async (ctx, args): Promise<Id<'swingVideos'>> => {
    const owns = await ctx.runQuery(internal.swingVideos.ownsProfile, {
      profileId: args.profileId,
    });

    if (!owns) {
      await ctx.runMutation(internal.swingVideos.discardUpload, {
        storageId: args.storageId,
        frameStorageIds: args.frameStorageIds,
      });
      throw new ConvexError({ message: 'Profile not found', code: 'NOT_FOUND' });
    }

    return await ctx.runMutation(internal.swingVideos.insertRecording, args);
  },
});

/** Recordings newest first, each with a playable URL. */
export const listRecordings = query({
  args: { profileId: v.id('golferProfiles') },
  handler: async (ctx, args) => {
    const owned = await ownedProfile(ctx, args.profileId);
    if (!owned) return [];

    const videos = await ctx.db
      .query('swingVideos')
      .withIndex('by_profile', (q) => q.eq('profileId', args.profileId))
      .order('desc')
      .take(50);

    return await Promise.all(
      videos.map(async (v) => ({
        ...v,
        url: await ctx.storage.getUrl(v.storageId),
      })),
    );
  },
});

export const deleteRecording = mutation({
  args: { videoId: v.id('swingVideos') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const video = await ctx.db.get(args.videoId);
    if (!video || video.userId !== userId) {
      throw new ConvexError({ message: 'Recording not found', code: 'NOT_FOUND' });
    }

    // Storage first: a dangling file costs money and is unreachable once the
    // row is gone. The extracted frames go with it.
    await ctx.storage.delete(video.storageId);
    for (const frameId of video.frameStorageIds ?? []) {
      // One missing frame must not strand the rest or the row itself.
      await ctx.storage.delete(frameId).catch(() => undefined);
    }
    await ctx.db.delete(args.videoId);
  },
});

/** Rename or annotate an existing recording. */
export const updateRecording = mutation({
  args: {
    videoId: v.id('swingVideos'),
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const video = await ctx.db.get(args.videoId);
    if (!video || video.userId !== userId) {
      throw new ConvexError({ message: 'Recording not found', code: 'NOT_FOUND' });
    }

    await ctx.db.patch(args.videoId, {
      ...(args.label !== undefined ? { label: args.label } : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    });
  },
});

// ─── AI swing analysis ───────────────────────────────────────────────────────
// The client pulls stills off the clip with expo-video-thumbnails and uploads
// them, so the model reads the actual swing. Frames are passed as Convex
// storage URLs, which are public-but-unguessable, and OpenAI fetches them.
// A recording with no frames still gets club-level guidance, flagged as such
// via `basis` so the UI never presents generic advice as a reading.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// Vision-capable by default; frames are useless to a text-only model.
const DEFAULT_MODEL = 'gpt-4o';
// Per-image fidelity. Dense frames at 'high' is the expensive combination, so
// this is the lever to pull if analyses cost more than they are worth.
const IMAGE_DETAIL = process.env.OPENAI_IMAGE_DETAIL === 'low' ? 'low' : 'high';
/**
 * Ceiling on frames per request. One analysis has to fit inside the account's
 * tokens-per-minute allowance, and a high-detail frame is ~700-1100 tokens, so
 * an entry-tier 30k TPM key tops out around two dozen. Raise it with
 * OPENAI_MAX_FRAMES once the OpenAI usage tier allows more. Recordings may hold
 * more frames than this - they are subsampled, never truncated.
 */
const MAX_ANALYSIS_FRAMES = Number(process.env.OPENAI_MAX_FRAMES ?? 24);

/** Evenly spaced subset, keeping the first and last so the span is preserved. */
function thinFrames(urls: string[], limit: number) {
  if (urls.length <= limit) return urls;
  const step = (urls.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => urls[Math.round(i * step)]);
}

/** Full recording plus a playable URL. Internal: skips the ownership check. */
export const getById = internalQuery({
  args: { videoId: v.id('swingVideos') },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) return null;

    // Resolve frames in swing order, dropping any the storage layer lost.
    const frameUrls = (
      await Promise.all((video.frameStorageIds ?? []).map((id) => ctx.storage.getUrl(id)))
    ).filter((url): url is string => url !== null);

    return { ...video, url: await ctx.storage.getUrl(video.storageId), frameUrls };
  },
});

export const setAnalysisStatus = internalMutation({
  args: {
    videoId: v.id('swingVideos'),
    status: v.union(v.literal('pending'), v.literal('done'), v.literal('error')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, { aiAnalysisStatus: args.status });
  },
});

export const saveAiFeedback = internalMutation({
  args: {
    videoId: v.id('swingVideos'),
    feedback: v.object({
      summary: v.string(),
      strengths: v.array(v.string()),
      improvements: v.array(v.string()),
      drills: v.array(v.string()),
      analyzedAt: v.string(),
      observations: v.optional(
        v.array(v.object({ position: v.string(), detail: v.string() })),
      ),
      basis: v.optional(v.union(v.literal('video'), v.literal('club'))),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, {
      aiFeedback: args.feedback,
      aiAnalysisStatus: 'done',
    });
  },
});

type FeedbackJson = {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  drills?: string[];
  observations?: { position?: string; detail?: string }[];
};

/** Pulls the first JSON object out of a reply that may be fenced or prefixed. */
function parseFeedback(content: string): FeedbackJson {
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned) as FeedbackJson;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Model reply was not JSON');
    return JSON.parse(match[0]) as FeedbackJson;
  }
}

export const analyzeSwing = action({
  args: { videoId: v.id('swingVideos') },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ message: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConvexError({
        message: 'Coaching notes are not configured on this deployment',
        code: 'NOT_CONFIGURED',
      });
    }

    const video = await ctx.runQuery(internal.swingVideos.getById, { videoId: args.videoId });
    // Ownership: ids come from the client, so a valid id is not permission.
    if (!video || video.userId !== userId) {
      throw new ConvexError({ message: 'Recording not found', code: 'NOT_FOUND' });
    }

    await ctx.runMutation(internal.swingVideos.setAnalysisStatus, {
      videoId: args.videoId,
      status: 'pending',
    });

    try {
      const notes = video.notes ? `
The golfer's own notes: "${video.notes}"` : '';
      const frames = thinFrames(video.frameUrls ?? [], MAX_ANALYSIS_FRAMES);
      const grounded = frames.length > 0;

      const prompt = grounded
        ? `You are a golf coach with decades of experience. You are looking at ${frames.length}
stills taken in order from a single clip, evenly spaced across it at roughly 10 frames per
second. Treat them as consecutive video frames: what changes between neighbouring frames is
evidence, and that is where tempo, sequencing and head movement show up.
The clip may start before the swing or run on after it, so not every phase is guaranteed to
appear. The club is "${video.label}".${notes}

Read the swing from what is actually visible. Identify which frames correspond to address,
takeaway, halfway back, the top of the backswing, transition, impact and the finish, then
work through setup and posture, spine angle, stance width, arm structure, shaft and hand
position at the top, hip and shoulder rotation, head movement frame to frame, weight
transfer, and balance at the finish.

Rules you must follow:
- Describe only what you can genuinely see. At 10 frames per second the exact moment of
  impact can still fall between two frames; say so rather than inferring it.
- Where something is not visible or is too blurred or obscured to judge, say so plainly
  in that observation rather than guessing.
- Never state a measured number - no clubhead speed, face angle, launch angle, smash
  factor or carry distance. None of that is visible in an image. Angles you can only
  estimate must be described in words, not degrees.
- If the frames do not show a golf swing at all, say exactly that in the summary and
  leave the other arrays empty.

Respond with pure JSON, no markdown, in exactly this shape:
{
  "summary": "2-3 sentences on what this swing actually shows",
  "observations": [
    {"position": "Address", "detail": "what is visible at setup"},
    {"position": "Takeaway", "detail": "..."},
    {"position": "Halfway back", "detail": "..."},
    {"position": "Top of backswing", "detail": "..."},
    {"position": "Transition", "detail": "..."},
    {"position": "Impact", "detail": "..."},
    {"position": "Finish", "detail": "..."}
  ],
  "strengths": ["something this swing genuinely does well", "..."],
  "improvements": ["highest priority fix visible in these frames", "..."],
  "drills": ["drill that targets the fix above, with instructions", "..."]
}

Keep each point under 30 words. Base every improvement on an observation above.`
        : `You are a golf coach with decades of experience.

A golfer logged a swing recording with the club "${video.label}".${notes}

You have NOT seen the video - no frames were available. Do not claim to have watched it
and do not describe what their swing looked like. Give the coaching points that matter
most for this club, written so they can check each against their own recording.

Respond with pure JSON, no markdown, in exactly this shape:
{
  "summary": "2-3 sentences on what matters most for this club",
  "strengths": ["what a good ${video.label} swing looks like 1", "2", "3"],
  "improvements": ["common fault to check for 1", "2", "3"],
  "drills": ["actionable drill with clear instructions 1", "2"]
}

Keep every point under 25 words.`;

      const content: Record<string, unknown>[] = [{ type: 'text', text: prompt }];
      for (const url of frames) {
        // 'high' costs several times more per image but posture and shaft position
        // are not legible at 'low'. Override with OPENAI_IMAGE_DETAIL to trade
        // accuracy for cost.'
        content.push({ type: 'image_url', image_url: { url, detail: IMAGE_DETAIL } });
      }

      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
          messages: [{ role: 'user', content }],
          response_format: { type: 'json_object' },
          max_completion_tokens: grounded ? 2000 : 600,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        if (response.status === 429) {
          // Distinct from a transient failure: retrying an oversized request
          // changes nothing, so say what actually has to change.
          throw new ConvexError({
            message:
              'This analysis is larger than the OpenAI account allows per minute. ' +
              'Record a shorter clip, or raise the account rate limit.',
            code: 'RATE_LIMITED',
          });
        }
        throw new Error(`OpenAI request failed: ${response.status} ${body.slice(0, 200)}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const parsed = parseFeedback(data.choices?.[0]?.message?.content ?? '');

      await ctx.runMutation(internal.swingVideos.saveAiFeedback, {
        videoId: args.videoId,
        feedback: {
          summary: parsed.summary ?? 'Analysis complete.',
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
          drills: Array.isArray(parsed.drills) ? parsed.drills.slice(0, 3) : [],
          analyzedAt: new Date().toISOString(),
          observations: Array.isArray(parsed.observations)
            ? parsed.observations
                .filter((o) => typeof o?.detail === 'string' && o.detail.length > 0)
                .slice(0, 8)
                .map((o) => ({ position: o.position ?? 'Swing', detail: o.detail as string }))
            : undefined,
          basis: grounded ? ('video' as const) : ('club' as const),
        },
      });
    } catch (error) {
      console.error('[analyzeSwing]', error instanceof Error ? error.message : String(error));
      await ctx.runMutation(internal.swingVideos.setAnalysisStatus, {
        videoId: args.videoId,
        status: 'error',
      });
      // A ConvexError thrown above already says something specific and
      // actionable - do not flatten it into the generic message.
      if (error instanceof ConvexError) throw error;
      throw new ConvexError({
        message: 'Could not generate coaching notes - please try again',
        code: 'EXTERNAL_SERVICE_ERROR',
      });
    }
  },
});
