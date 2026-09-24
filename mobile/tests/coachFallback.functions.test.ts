/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { mockModel } from '@convex-dev/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../convex/_generated/api';
import { isRateLimited } from '../convex/lib/openaiErrors';

import { signInWithProfile, testApp, type TestConvex } from './helpers';

/**
 * The fallback from gpt-4o to gpt-4o-mini, with OpenAI replaced by fakes.
 *
 * A real rate limit cannot be produced on demand, and the path it takes is the
 * one that matters: the AI SDK does not throw on a failed request, it ends the
 * stream empty and reports the error to `onError`. These fakes fail the same
 * way, so the test exercises the code the way OpenAI would.
 */
const models = vi.hoisted(() => ({
  primary: 'ok' as 'ok' | 'rate-limited' | 'broken',
  fallback: 'ok' as 'ok' | 'rate-limited',
  calls: [] as string[],
}));

vi.mock('@ai-sdk/openai', async () => {
  const { mockModel: mock } = await import('@convex-dev/agent');
  const failing = (message: string, statusCode?: number) =>
    mock({
      doStream: async () => {
        throw Object.assign(new Error(message), statusCode ? { statusCode } : {});
      },
    });
  return {
    openai: {
      chat: (modelId: string) => {
        const isFallback = modelId === 'gpt-4o-mini';
        return new Proxy(
          {},
          {
            // Resolved per call, so each test can decide how the model behaves.
            get(_t, prop) {
              const state = isFallback ? models.fallback : models.primary;
              const model =
                state === 'rate-limited'
                  ? failing(`Rate limit reached for ${modelId}`, 429)
                  : state === 'broken'
                    ? failing('The server had an error while processing your request')
                    : mock({ content: [{ type: 'text', text: `Answer from ${modelId}` }] });
              if (prop === 'doStream') models.calls.push(modelId);
              const value = (model as unknown as Record<string | symbol, unknown>)[prop];
              return typeof value === 'function' ? value.bind(model) : value;
            },
          },
        );
      },
    },
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  models.primary = 'ok';
  models.fallback = 'ok';
  models.calls = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Asks a question, runs the reply to completion, returns the coach's words. */
async function ask(t: TestConvex) {
  const { asUser, profileId } = await signInWithProfile(t);
  await asUser.mutation(api.coachChat.sendMessage, { profileId, prompt: 'Why do I slice?' });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const page = await asUser.query(api.coachChat.listMessages, {
    profileId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  return page.page
    .filter((m) => m.message?.role === 'assistant' && m.text)
    .map((m) => m.text!);
}

describe('the coach reply when gpt-4o is busy', () => {
  it('answers with gpt-4o when it has allowance', async () => {
    expect(await ask(testApp())).toEqual(['Answer from gpt-4o']);
    expect(models.calls).not.toContain('gpt-4o-mini');
  });

  it('answers with gpt-4o-mini, not an error, when gpt-4o is rate limited', async () => {
    models.primary = 'rate-limited';
    expect(await ask(testApp())).toEqual(['Answer from gpt-4o-mini']);
  });

  it('says to wait only when the fallback is out of allowance too', async () => {
    models.primary = 'rate-limited';
    models.fallback = 'rate-limited';
    const replies = await ask(testApp());
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatch(/rate limit/);
  });

  it('does not reach for the fallback on an error that is not a rate limit', async () => {
    // A broken request is not solved by a different model, and quietly
    // answering from mini would hide it.
    models.primary = 'broken';
    const replies = await ask(testApp());
    expect(replies).toEqual(['Your coach could not answer that one - please try again.']);
    expect(models.calls).not.toContain('gpt-4o-mini');
  });
});

describe('isRateLimited', () => {
  it.each([
    [{ statusCode: 429 }, true],
    [{ status: 429 }, true],
    [new Error('Rate limit reached for gpt-4o in organization org-x on tokens per min'), true],
    [new Error('429 Too Many Requests'), true],
    [new Error('The server had an error while processing your request'), false],
    [{ statusCode: 500 }, false],
    ['timeout', false],
  ])('%s -> %s', (error, expected) => {
    expect(isRateLimited(error)).toBe(expected);
  });
});

// Keeps the import used when the mock factory re-imports it dynamically.
void mockModel;
