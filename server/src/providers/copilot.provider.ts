import { CopilotClient } from '@microsoft/copilot-sdk';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt.js';
import { StudyPlanSchema, type StudyPlan, type StudyPlanRequest } from '../schema.js';
import type { StudyPlanProvider } from './study-plan-provider.js';

interface CopilotProviderOptions {
  /** GitHub token with Copilot access. When omitted the SDK uses the locally logged-in user. */
  githubToken?: string;
  /** Copilot model id; undefined = runtime default. */
  model?: string;
  timeoutMs: number;
}

/**
 * Primary provider: GitHub Copilot via the Copilot SDK.
 * The SDK drives the Copilot runtime over JSON-RPC, so this must run server-side (Node only).
 */
export class CopilotStudyPlanProvider implements StudyPlanProvider {
  readonly name = 'github-copilot' as const;
  readonly model: string | null;
  private clientPromise?: Promise<CopilotClient>;

  constructor(private readonly options: CopilotProviderOptions) {
    this.model = options.model ?? null;
  }

  /** Lazily start one shared client; reset on failure so the next request can retry. */
  private getClient(): Promise<CopilotClient> {
    if (!this.clientPromise) {
      const client = new CopilotClient({
        mode: 'coding-agent',
        github: this.options.githubToken ? { token: this.options.githubToken } : undefined,
      });
      this.clientPromise = client
        .start()
        .then(() => client)
        .catch((err: unknown) => {
          this.clientPromise = undefined;
          throw err;
        });
    }
    return this.clientPromise;
  }

  async generate(request: StudyPlanRequest): Promise<StudyPlan> {
    const client = await this.getClient();
    const session = await client.createSession({
      clientName: 'certification-store',
      model: this.options.model,
      systemMessage: { mode: 'replace', content: SYSTEM_PROMPT },
      // Pure text generation: expose no tools (no shell, file or web access).
      tools: { availableTools: [] },
    });

    try {
      // sendAndWait with a Zod response schema returns the parsed, validated object.
      return await session.sendAndWait({ prompt: buildUserPrompt(request) }, StudyPlanSchema, this.options.timeoutMs);
    } finally {
      await session.disconnect().catch(() => undefined);
    }
  }

  async dispose(): Promise<void> {
    const client = await this.clientPromise?.catch(() => undefined);
    await client?.stop();
  }
}
