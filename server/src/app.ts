import { STATUS_CODES } from 'node:http';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { config as appConfig } from './config.js';
import { StudyPlanRequestSchema } from './schema.js';
import { AllProvidersFailedError, type StudyPlanService } from './study-plan.service.js';

/** The config fields the app needs. Type-only import, so tests never load `.env`. */
export type AppConfig = Pick<typeof appConfig, 'isDev' | 'copilot' | 'gemini'>;

export interface AppOptions {
  studyPlans: Pick<StudyPlanService, 'generate'>;
  config: AppConfig;
  /** Environment used for credential checks in the health diagnostics. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
}

/** Health diagnostics: booleans, provider order and model names only. Never return credential values here. */
export function buildHealthDiagnostics(config: AppConfig, env: NodeJS.ProcessEnv = process.env) {
  return {
    'github-copilot': {
      order: 1,
      tokenConfigured: Boolean(config.copilot.githubToken),
      model: config.copilot.model ?? 'runtime default',
    },
    gemini: {
      order: 2,
      apiKeyConfigured: Boolean(config.gemini.apiKey || env['GOOGLE_API_KEY']),
      vertexAi: config.gemini.usesVertexAi,
      model: config.gemini.model,
    },
  };
}

/** Client-safe messages for 4xx errors raised by the body parser (malformed JSON, body too large, ...). */
const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: 'Malformed request body.',
  413: 'Request body too large (limit 32 kB).',
};

function clientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const status = (err as { status?: unknown; statusCode?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

/** Builds the Express app without starting it, so tests can run it with stub providers. */
export function createApp({ studyPlans, config, env = process.env }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    // Provider/credential diagnostics (booleans only, never values) are dev-only.
    if (!config.isDev) {
      res.json({ status: 'ok' });
      return;
    }
    res.json({ status: 'ok', providers: buildHealthDiagnostics(config, env) });
  });

  app.post('/api/study-plan', async (req, res) => {
    const parsed = StudyPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
      return;
    }

    try {
      res.json(await studyPlans.generate(parsed.data));
    } catch (err) {
      if (err instanceof AllProvidersFailedError) {
        res.status(502).json({ error: 'Study plan generation failed on all providers.', failures: err.failures });
        return;
      }
      throw err;
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = clientErrorStatus(err);
    if (status !== undefined) {
      res.status(status).json({ error: CLIENT_ERROR_MESSAGES[status] ?? STATUS_CODES[status] ?? 'Bad request' });
      return;
    }
    console.error('[server] Unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
