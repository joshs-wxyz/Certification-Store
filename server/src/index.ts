import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { ClaudeStudyPlanProvider } from './providers/claude.provider.js';
import { CopilotStudyPlanProvider } from './providers/copilot.provider.js';
import { StudyPlanRequestSchema } from './schema.js';
import { AllProvidersFailedError, StudyPlanService } from './study-plan.service.js';

const studyPlans = new StudyPlanService([
  new CopilotStudyPlanProvider({
    githubToken: config.copilot.githubToken,
    model: config.copilot.model,
    timeoutMs: config.aiTimeoutMs,
  }),
  new ClaudeStudyPlanProvider({
    apiKey: config.claude.apiKey,
    model: config.claude.model,
    timeoutMs: config.aiTimeoutMs,
  }),
]);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    providers: {
      'github-copilot': { order: 1, tokenConfigured: Boolean(config.copilot.githubToken), model: config.copilot.model ?? 'runtime default' },
      claude: { order: 2, apiKeyConfigured: Boolean(config.claude.apiKey), model: config.claude.model },
    },
  });
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
  console.error('[server] Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`[server] Certification-Store API listening on http://localhost:${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close();
  await studyPlans.dispose();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
