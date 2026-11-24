import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js';
import { StudyPlanSchema, type StudyPlan, type StudyPlanRequest } from '../schema.js';
import type { StudyPlanProvider } from './study-plan-provider.js';

interface ClaudeProviderOptions {
  /** When omitted the SDK resolves credentials from the environment (ANTHROPIC_API_KEY, etc.). */
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

/** Fallback provider: Claude via the official Anthropic TypeScript SDK, using structured outputs. */
export class ClaudeStudyPlanProvider implements StudyPlanProvider {
  readonly name = 'claude' as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(options: ClaudeProviderOptions) {
    this.model = options.model;
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs });
  }

  async generate(request: StudyPlanRequest): Promise<StudyPlan> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // Server-side refusal fallback: if a safety classifier declines, the API
      // re-runs the request on a suitable fallback model within the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'medium',
        format: betaZodOutputFormat(StudyPlanSchema),
      },
      messages: [{ role: 'user', content: buildUserPrompt(request) }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(`Claude declined the request (${response.stop_details?.category ?? 'unspecified'}).`);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Claude response was truncated (max_tokens reached).');
    }
    if (!response.parsed_output) {
      throw new Error('Claude returned output that did not match the study plan schema.');
    }
    return response.parsed_output;
  }
}
