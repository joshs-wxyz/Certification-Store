import { ApiError } from '@google/genai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllProvidersFailedError, StudyPlanService, describeError } from './study-plan.service.js';
import { stubProvider, validRequest } from './test/helpers.js';

describe('describeError', () => {
  it.each([
    [400, 'API key not valid. Please pass a valid API key.', 'Gemini rejected the API key (check GEMINI_API_KEY).'],
    [401, 'unauthenticated', 'Gemini authentication failed (check GEMINI_API_KEY or Vertex AI credentials).'],
    [403, 'permission denied', 'Gemini authentication failed (check GEMINI_API_KEY or Vertex AI credentials).'],
    [404, 'model not found', 'Gemini model not found (check GEMINI_MODEL).'],
    [429, 'resource exhausted', 'Rate limited or out of quota on the Gemini API.'],
    [500, 'backend error', 'Gemini API error 500: backend error'],
  ])('maps Gemini ApiError %i', (status, message, expected) => {
    expect(describeError(new ApiError({ status, message }))).toBe(expected);
  });

  it('maps a TimeoutError', () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    expect(describeError(err)).toBe('Timed out (AI_TIMEOUT_MS).');
  });

  it('uses the message of a plain Error', () => {
    expect(describeError(new Error('something broke'))).toBe('something broke');
  });

  it('stringifies non-Error values', () => {
    expect(describeError('raw string')).toBe('raw string');
  });

  it('truncates long messages to 300 characters plus an ellipsis', () => {
    const result = describeError(new Error('x'.repeat(500)));
    expect(result).toBe(`${'x'.repeat(300)}…`);
  });
});

describe('StudyPlanService', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('tries providers in order and stops at the first success', async () => {
    const first = stubProvider('github-copilot', { error: new Error('nope') });
    const second = stubProvider('gemini', {});
    const third = stubProvider('gemini', {}, 'never-called');

    const result = await new StudyPlanService([first, second, third]).generate(validRequest());

    expect(result.provider).toBe('gemini');
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
    expect(third.calls).toHaveLength(0);
  });

  it('throws AllProvidersFailedError with every failure in order', async () => {
    const service = new StudyPlanService([
      stubProvider('github-copilot', { error: new Error('a') }),
      stubProvider('gemini', { error: new Error('b') }),
    ]);

    const error = await service.generate(validRequest()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect((error as AllProvidersFailedError).failures).toEqual([
      { provider: 'github-copilot', reason: 'a' },
      { provider: 'gemini', reason: 'b' },
    ]);
  });

  it('dispose() calls every provider dispose, even if one rejects', async () => {
    const disposed: string[] = [];
    const a = { ...stubProvider('github-copilot', {}), dispose: async () => void disposed.push('a') };
    const b = { ...stubProvider('gemini', {}), dispose: () => Promise.reject(new Error('fail')) };
    const c = { ...stubProvider('gemini', {}), dispose: async () => void disposed.push('c') };

    await expect(new StudyPlanService([a, b, c]).dispose()).resolves.toBeUndefined();
    expect(disposed).toEqual(['a', 'c']);
  });
});
