import { FinishReason, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js';
import { StudyPlanSchema, type StudyPlan, type StudyPlanRequest } from '../schema.js';
import type { StudyPlanProvider } from './study-plan-provider.js';

interface GeminiProviderOptions {
  /**
   * Gemini Developer API key. When omitted the SDK reads its own environment variables:
   * GEMINI_API_KEY / GOOGLE_API_KEY, or Vertex AI via GOOGLE_GENAI_USE_VERTEXAI=true +
   * GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION (Application Default Credentials).
   */
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

/** JSON Schema sent to Gemini for structured output, derived from the shared Zod schema. */
const { $schema: _ignored, ...STUDY_PLAN_JSON_SCHEMA } = z.toJSONSchema(StudyPlanSchema);

/** Fallback provider: Google Gemini via the official Google Gen AI SDK (@google/genai), using structured output. */
export class GeminiStudyPlanProvider implements StudyPlanProvider {
  readonly name = 'gemini' as const;
  readonly model: string;
  private readonly client: GoogleGenAI;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions) {
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.client = new GoogleGenAI(options.apiKey ? { apiKey: options.apiKey } : {});
  }

  async generate(request: StudyPlanRequest): Promise<StudyPlan> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: buildUserPrompt(request),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: STUDY_PLAN_JSON_SCHEMA,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
      },
    });

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked the prompt (${blockReason}).`);
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === FinishReason.MAX_TOKENS) {
      throw new Error('Gemini response was truncated (MAX_TOKENS).');
    }
    if (finishReason && finishReason !== FinishReason.STOP) {
      throw new Error(`Gemini stopped generating (${finishReason}).`);
    }

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Gemini returned invalid JSON.');
    }

    // The API enforces only a subset of JSON Schema, so always validate locally.
    const parsed = StudyPlanSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('Gemini returned output that did not match the study plan schema.');
    }
    return parsed.data;
  }
}
