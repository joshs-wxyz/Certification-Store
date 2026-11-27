import { STATUS_CODES } from 'node:http';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { config as appConfig } from './config.js';
import { AuthService, EmailAlreadyRegisteredError, InvalidCredentialsError, LoginSchema, RegisterSchema } from './auth.service.js';
import { CertificationSchema, StudyPlanRequestSchema } from './schema.js';
import { AllProvidersFailedError, type StudyPlanService } from './study-plan.service.js';
import type { CertificationStore } from './certification.service.js';

/** The config fields the app needs. Type-only import, so tests never load `.env`. */
export type AppConfig = Pick<typeof appConfig, 'isDev' | 'copilot' | 'gemini'>;

export interface AppOptions {
  studyPlans: Pick<StudyPlanService, 'generate'>;
  auth: AuthService;
  certifications: CertificationStore;
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
export function createApp({ studyPlans, auth, certifications, config, env = process.env }: AppOptions): Express {
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

  app.post('/api/auth/register', async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid registration details.', issues: parsed.error.issues });
      return;
    }

    try {
      const result = await auth.register(parsed.data);
      setSessionCookie(res, result.token, config.isDev);
      res.status(201).json({ user: result.user });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid email or password.', issues: parsed.error.issues });
      return;
    }

    try {
      const result = await auth.login(parsed.data);
      setSessionCookie(res, result.token, config.isDev);
      res.json({ user: result.user });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const user = auth.currentUser(readSessionToken(req.headers.cookie));
    if (!user) {
      res.status(401).json({ error: 'Not signed in.' });
      return;
    }
    res.json({ user });
  });

  app.post('/api/auth/logout', (req, res) => {
    auth.logout(readSessionToken(req.headers.cookie));
    res.setHeader('Set-Cookie', clearSessionCookie(config.isDev));
    res.status(204).end();
  });

  app.get('/api/certifications', (req, res) => {
    const user = auth.currentUser(readSessionToken(req.headers.cookie));
    if (!user) {
      res.status(401).json({ error: 'Sign in to load your account catalog.' });
      return;
    }
    res.json({ certifications: certifications.listForUser(user.id) });
  });

  app.post('/api/certifications', (req, res) => {
    const user = auth.currentUser(readSessionToken(req.headers.cookie));
    if (!user) {
      res.status(401).json({ error: 'Sign in to save certifications to your account.' });
      return;
    }

    const parsed = CertificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid certification.', issues: parsed.error.issues });
      return;
    }

    certifications.addForUser(user.id, parsed.data);
    res.status(201).json({ certification: parsed.data });
  });

  app.delete('/api/certifications/:id', (req, res) => {
    const user = auth.currentUser(readSessionToken(req.headers.cookie));
    if (!user) {
      res.status(401).json({ error: 'Sign in to remove certifications from your account.' });
      return;
    }

    const id = z.string().min(1).max(100).safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: 'Invalid certification id.' });
      return;
    }

    certifications.removeForUser(user.id, id.data);
    res.status(204).end();
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

function readSessionToken(cookieHeader: string | undefined): string | undefined {
  const prefix = `${AuthService.sessionCookieName}=`;
  const cookie = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  const token = cookie?.slice(prefix.length);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

function setSessionCookie(res: Response, token: string, isDev: boolean): void {
  const secure = isDev ? '' : '; Secure';
  res.setHeader(
    'Set-Cookie',
    `${AuthService.sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${AuthService.sessionMaxAgeSeconds}${secure}`,
  );
}

function clearSessionCookie(isDev: boolean): string {
  const secure = isDev ? '' : '; Secure';
  return `${AuthService.sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
