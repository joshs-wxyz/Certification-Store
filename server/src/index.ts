import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AuthService } from './auth.service.js';
import { SqliteStore } from './sqlite.store.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { CopilotStudyPlanProvider } from './providers/copilot.provider.js';
import { GeminiStudyPlanProvider } from './providers/gemini.provider.js';
import { StudyPlanService } from './study-plan.service.js';

// The order of this list is the fallback order.
const studyPlans = new StudyPlanService([
  new CopilotStudyPlanProvider({
    githubToken: config.copilot.githubToken,
    model: config.copilot.model,
    timeoutMs: config.aiTimeoutMs,
  }),
  new GeminiStudyPlanProvider({
    apiKey: config.gemini.apiKey,
    model: config.gemini.model,
    timeoutMs: config.aiTimeoutMs,
  }),
]);

const dataDirectory = fileURLToPath(new URL('../data/', import.meta.url));
mkdirSync(dataDirectory, { recursive: true });
const database = new SqliteStore(join(dataDirectory, 'users.sqlite'));
const auth = new AuthService(database);
const app = createApp({ studyPlans, auth, certifications: database, config });

const server = app.listen(config.port, () => {
  console.log(`[server] Certification-Store API listening on http://localhost:${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close();
  await studyPlans.dispose();
  database.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
