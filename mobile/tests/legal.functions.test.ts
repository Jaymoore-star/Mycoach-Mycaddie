/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest';

import { testApp } from './helpers';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(['/privacy', '/delete-account'])('%s', (path) => {
  it('is served as a page anyone can open, signed in or not', async () => {
    const t = testApp();
    const res = await t.fetch(path, { method: 'GET' });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('MyCoach / MyCaddie');
  });

  it('says it is a draft until the contact address is set', async () => {
    const t = testApp();
    vi.stubEnv('SUPPORT_EMAIL', '');

    const body = await (await t.fetch(path, { method: 'GET' })).text();
    expect(body).toContain('Not for publication');
    expect(body).not.toContain('mailto:');
  });

  it('shows the address, and no draft banner, once it is set', async () => {
    const t = testApp();
    vi.stubEnv('SUPPORT_EMAIL', 'help@example.com');

    const body = await (await t.fetch(path, { method: 'GET' })).text();
    expect(body).toContain('mailto:help@example.com');
    expect(body).not.toContain('Not for publication');
  });
});
