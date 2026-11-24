import { ApiError as GeminiApiError } from '@google/genai';
import type { StudyPlanProvider } from './providers/study-plan-provider.js';
import type { StudyPlanRequest, StudyPlanResponse } from './schema.js';

export class AllProvidersFailedError extends Error {
  constructor(readonly failures: { provider: string; reason: string }[]) {
    super('All study plan providers failed.');
  }
}

/** Short, non-sensitive description of a provider error for logs and the API response. */
export function describeError(err: unknown): string {
  if (err instanceof GeminiApiError) {
    if (err.status === 400 && /api key/i.test(err.message)) return 'Gemini rejected the API key (check GEMINI_API_KEY).';
    if (err.status === 401 || err.status === 403) return 'Gemini authentication failed (check GEMINI_API_KEY or Vertex AI credentials).';
    if (err.status === 404) return 'Gemini model not found (check GEMINI_MODEL).';
    if (err.status === 429) return 'Rate limited or out of quota on the Gemini API.';
    return `Gemini API error ${err.status}: ${truncate(err.message)}`;
  }
  if (err instanceof Error && err.name === 'TimeoutError') return 'Timed out (AI_TIMEOUT_MS).';
  if (err instanceof Error) return truncate(err.message);
  return truncate(String(err));
}

function truncate(message: string, max = 300): string {
  return message.length > max ? `${message.slice(0, max)}…` : message;
}

/**
 * Tries providers in order (Copilot first, then Gemini) and returns the first success.
 */
export class StudyPlanService {
  constructor(private readonly providers: readonly StudyPlanProvider[]) {}

  async generate(request: StudyPlanRequest): Promise<StudyPlanResponse> {
    const failures: { provider: string; reason: string }[] = [];

    for (const provider of this.providers) {
      try {
        const plan = await provider.generate(request);
        return {
          plan,
          provider: provider.name,
          model: provider.model,
          fallbackReason: failures.length
            ? failures.map((f) => `${f.provider}: ${f.reason}`).join(' | ')
            : undefined,
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        const reason = describeError(err);
        console.warn(`[study-plan] ${provider.name} failed: ${reason}`);
        failures.push({ provider: provider.name, reason });
      }
    }

    throw new AllProvidersFailedError(failures);
  }

  async dispose(): Promise<void> {
    await Promise.allSettled(this.providers.map((p) => p.dispose?.()));
  }
}
