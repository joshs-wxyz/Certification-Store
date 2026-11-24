import Anthropic from '@anthropic-ai/sdk';
import type { StudyPlanProvider } from './providers/study-plan-provider.js';
import type { StudyPlanRequest, StudyPlanResponse } from './schema.js';

export class AllProvidersFailedError extends Error {
  constructor(readonly failures: { provider: string; reason: string }[]) {
    super('All study plan providers failed.');
  }
}

/** Short, non-sensitive description of a provider error for logs and the API response. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Authentication failed (check ANTHROPIC_API_KEY).';
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited by the Claude API.';
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ''}: ${err.message}`.trim();
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Tries providers in order (Copilot first, then Claude) and returns the first success.
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
