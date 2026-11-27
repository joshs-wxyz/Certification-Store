import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHealthDiagnostics } from './app.js';
import { postJson, samplePlan, startApp, stubProvider, testConfig, validRequest } from './test/helpers.js';

type Running = Awaited<ReturnType<typeof startApp>>;

let running: Running | undefined;

async function start(...args: Parameters<typeof startApp>) {
  running = await startApp(...args);
  return running.url;
}

beforeEach(() => {
  // The service and error handler log failures; keep test output clean.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await running?.close();
  running = undefined;
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('returns only { status: "ok" } in production', async () => {
    const url = await start({ providers: [], config: testConfig({ isDev: false }) });
    const res = await fetch(`${url}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns provider diagnostics in dev', async () => {
    const url = await start({ providers: [], config: testConfig({ isDev: true }) });
    const body = await (await fetch(`${url}/api/health`)).json();
    expect(body).toEqual({
      status: 'ok',
      providers: {
        'github-copilot': { order: 1, tokenConfigured: false, model: 'runtime default' },
        gemini: { order: 2, apiKeyConfigured: false, vertexAi: false, model: 'gemini-test-model' },
      },
    });
  });

  it('never includes credential values, only booleans', async () => {
    const config = testConfig({
      isDev: true,
      copilot: { githubToken: 'GH-SECRET-VALUE', model: 'copilot-model' },
      gemini: { apiKey: 'GEMINI-SECRET-VALUE', model: 'gemini-model', usesVertexAi: false },
    });
    const url = await start({ providers: [], config, env: { GOOGLE_API_KEY: 'GOOGLE-SECRET-VALUE' } });
    const res = await fetch(`${url}/api/health`);
    const text = await res.text();

    expect(text).not.toMatch(/SECRET-VALUE/);
    const body = JSON.parse(text);
    expect(body.providers['github-copilot'].tokenConfigured).toBe(true);
    expect(body.providers.gemini.apiKeyConfigured).toBe(true);
  });

  it('counts GOOGLE_API_KEY as a configured Gemini key', () => {
    const diagnostics = buildHealthDiagnostics(testConfig(), { GOOGLE_API_KEY: 'x' });
    expect(diagnostics.gemini.apiKeyConfigured).toBe(true);
  });
});

describe('POST /api/study-plan', () => {
  it('returns the primary provider plan', async () => {
    const copilot = stubProvider('github-copilot', {});
    const gemini = stubProvider('gemini', {});
    const url = await start({ providers: [copilot, gemini] });

    const res = await postJson(`${url}/api/study-plan`, validRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ plan: samplePlan(), provider: 'github-copilot', model: 'github-copilot-test-model' });
    expect(body.fallbackReason).toBeUndefined();
    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false);
    expect(copilot.calls).toEqual([validRequest()]);
    expect(gemini.calls).toHaveLength(0);
  });

  it('falls back to the next provider and reports why', async () => {
    const url = await start({
      providers: [stubProvider('github-copilot', { error: new Error('copilot down') }), stubProvider('gemini', {})],
    });

    const res = await postJson(`${url}/api/study-plan`, validRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe('gemini');
    expect(body.model).toBe('gemini-test-model');
    expect(body.fallbackReason).toBe('github-copilot: copilot down');
  });

  it('returns 502 with every failure when all providers fail', async () => {
    const url = await start({
      providers: [
        stubProvider('github-copilot', { error: new Error('copilot down') }),
        stubProvider('gemini', { error: new Error('gemini down') }),
      ],
    });

    const res = await postJson(`${url}/api/study-plan`, validRequest());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: 'Study plan generation failed on all providers.',
      failures: [
        { provider: 'github-copilot', reason: 'copilot down' },
        { provider: 'gemini', reason: 'gemini down' },
      ],
    });
  });

  it.each([
    ['missing description', (r: any) => delete r.certification.description],
    ['empty title', (r: any) => (r.certification.title = '')],
    ['weeks = 0', (r: any) => (r.preferences.weeks = 0)],
    ['weeks = 27', (r: any) => (r.preferences.weeks = 27)],
    ['hoursPerWeek = 41', (r: any) => (r.preferences.hoursPerWeek = 41)],
    ['fractional weeks', (r: any) => (r.preferences.weeks = 1.5)],
    ['unknown experienceLevel', (r: any) => (r.preferences.experienceLevel = 'expert')],
    ['too many intendedFor entries', (r: any) => (r.certification.intendedFor = Array(21).fill('x'))],
  ])('returns 400 for an invalid request: %s', async (_label, mutate) => {
    const provider = stubProvider('github-copilot', {});
    const url = await start({ providers: [provider] });
    const request = validRequest();
    mutate(request);

    const res = await postJson(`${url}/api/study-plan`, request);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
    expect(Array.isArray(body.issues)).toBe(true);
    expect(provider.calls).toHaveLength(0);
  });

  it('accepts the boundary values', async () => {
    const url = await start({ providers: [stubProvider('github-copilot', {})] });
    const request = validRequest();
    request.preferences = { experienceLevel: 'advanced', weeks: 26, hoursPerWeek: 40 };
    delete request.certification.vendor;
    delete request.certification.level;

    const res = await postJson(`${url}/api/study-plan`, request);
    expect(res.status).toBe(200);
  });

  it('returns 400 when the body is not JSON', async () => {
    const url = await start({ providers: [stubProvider('github-copilot', {})] });
    const res = await fetch(`${url}/api/study-plan`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 (not 500) for malformed JSON', async () => {
    const url = await start({ providers: [stubProvider('github-copilot', {})] });
    const res = await fetch(`${url}/api/study-plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"certification": ',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Malformed request body.' });
  });

  it('returns 413 (not 500) for a body over 32 kB', async () => {
    const url = await start({ providers: [stubProvider('github-copilot', {})] });
    const request = validRequest();
    request.preferences.focusNotes = 'x'.repeat(40 * 1024);

    const res = await postJson(`${url}/api/study-plan`, request);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Request body too large (limit 32 kB).' });
  });

  it('returns a generic 500 for unexpected errors, without internal details', async () => {
    const url = await start({
      providers: [],
      studyPlans: { generate: () => Promise.reject(new Error('internal detail: db password=hunter2')) },
    });

    const res = await postJson(`${url}/api/study-plan`, validRequest());
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Internal server error' });
    expect(text).not.toMatch(/hunter2|internal detail/);
  });
});

describe('account authentication', () => {
  it('creates an account and restores and clears its session', async () => {
    const url = await start({ providers: [] });
    const registration = await postJson(`${url}/api/auth/register`, {
      name: 'Jordan Lee',
      email: 'Jordan@example.com',
      password: 'a-secure-password',
    });

    expect(registration.status).toBe(201);
    expect(registration.headers.get('set-cookie')).toMatch(/cs_session=.*HttpOnly/);
    const { user } = await registration.json();
    expect(user).toMatchObject({ name: 'Jordan Lee', email: 'jordan@example.com' });
    expect(user.passwordHash).toBeUndefined();

    const cookie = registration.headers.get('set-cookie')!;
    const restored = await fetch(`${url}/api/auth/me`, { headers: { cookie } });
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual({ user });

    const signedOut = await fetch(`${url}/api/auth/logout`, { method: 'POST', headers: { cookie } });
    expect(signedOut.status).toBe(204);
    const afterLogout = await fetch(`${url}/api/auth/me`, { headers: { cookie } });
    expect(afterLogout.status).toBe(401);
  });

  it('rejects duplicate email addresses regardless of case', async () => {
    const url = await start({ providers: [] });
    const account = { name: 'Jordan', email: 'jordan@example.com', password: 'a-secure-password' };
    expect((await postJson(`${url}/api/auth/register`, account)).status).toBe(201);

    const duplicate = await postJson(`${url}/api/auth/register`, { ...account, email: 'JORDAN@example.com' });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: 'An account with this email already exists.' });
  });

  it('accepts valid credentials and rejects invalid credentials', async () => {
    const url = await start({ providers: [] });
    await postJson(`${url}/api/auth/register`, {
      name: 'Jordan',
      email: 'jordan@example.com',
      password: 'a-secure-password',
    });

    const invalid = await postJson(`${url}/api/auth/login`, {
      email: 'jordan@example.com',
      password: 'wrong-password',
    });
    expect(invalid.status).toBe(401);

    const login = await postJson(`${url}/api/auth/login`, {
      email: 'JORDAN@example.com',
      password: 'a-secure-password',
    });
    expect(login.status).toBe(200);
    expect((await login.json()).user.email).toBe('jordan@example.com');
  });

  it('validates account input without writing an account', async () => {
    const url = await start({ providers: [] });
    const response = await postJson(`${url}/api/auth/register`, {
      name: '',
      email: 'not-an-email',
      password: 'short',
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid registration details.');
  });
});

describe('account certification catalogs', () => {
  const firstCertification = {
    id: 'aws-associate-1',
    title: 'AWS Associate',
    vendor: 'AWS',
    level: 'Associate',
    shortDescription: 'Cloud architecture',
    description: 'Design cloud solutions.',
    intendedFor: ['Cloud engineers'],
    createdAt: '2026-10-10T12:00:00.000Z',
  };

  it('stores certifications under the authenticated account and isolates other accounts', async () => {
    const url = await start({ providers: [] });
    const first = await postJson(`${url}/api/auth/register`, {
      name: 'Jordan',
      email: 'jordan@example.com',
      password: 'a-secure-password',
    });
    const firstCookie = first.headers.get('set-cookie')!;

    const saved = await postJson(`${url}/api/certifications`, firstCertification);
    // Account writes require the session cookie.
    const savedWithSession = await fetch(`${url}/api/certifications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: firstCookie },
      body: JSON.stringify(firstCertification),
    });
    expect(saved.status).toBe(401);
    await saved.json();
    expect(savedWithSession.status).toBe(201);
    expect(await savedWithSession.json()).toEqual({ certification: firstCertification });

    const firstCatalog = await fetch(`${url}/api/certifications`, { headers: { cookie: firstCookie } });
    expect((await firstCatalog.json()).certifications).toEqual([firstCertification]);

    const second = await postJson(`${url}/api/auth/register`, {
      name: 'Casey',
      email: 'casey@example.com',
      password: 'another-secure-password',
    });
    const secondCookie = second.headers.get('set-cookie')!;
    const secondCatalog = await fetch(`${url}/api/certifications`, { headers: { cookie: secondCookie } });
    expect((await secondCatalog.json()).certifications).toEqual([]);

    const deleteWithOtherAccount = await fetch(`${url}/api/certifications/${firstCertification.id}`, {
      method: 'DELETE',
      headers: { cookie: secondCookie },
    });
    expect(deleteWithOtherAccount.status).toBe(204);
    const firstCatalogAfter = await fetch(`${url}/api/certifications`, { headers: { cookie: firstCookie } });
    expect((await firstCatalogAfter.json()).certifications).toEqual([firstCertification]);

    const deleteWithOwner = await fetch(`${url}/api/certifications/${firstCertification.id}`, {
      method: 'DELETE',
      headers: { cookie: firstCookie },
    });
    expect(deleteWithOwner.status).toBe(204);
    const emptyCatalog = await fetch(`${url}/api/certifications`, { headers: { cookie: firstCookie } });
    expect((await emptyCatalog.json()).certifications).toEqual([]);
  });

  it('rejects invalid certification data', async () => {
    const url = await start({ providers: [] });
    const registration = await postJson(`${url}/api/auth/register`, {
      name: 'Jordan',
      email: 'jordan@example.com',
      password: 'a-secure-password',
    });
    const response = await fetch(`${url}/api/certifications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: registration.headers.get('set-cookie')! },
      body: JSON.stringify({ ...firstCertification, level: 'Unspecified' }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid certification.');
  });
});

describe('security headers', () => {
  it('does not send x-powered-by', async () => {
    const url = await start({ providers: [] });
    const res = await fetch(`${url}/api/health`);
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});
