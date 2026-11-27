import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { AuthService } from '../auth.service.js';
import { SqliteStore } from '../sqlite.store.js';
import { createApp, type AppConfig, type AppOptions } from '../app.js';
import type { StudyPlanProvider } from '../providers/study-plan-provider.js';
import type { ProviderName, StudyPlan, StudyPlanRequest } from '../schema.js';
import { StudyPlanService } from '../study-plan.service.js';

/** Test helpers. Tests must never call real AI APIs: use these stubs instead of the real providers. */

export const validRequest = (): StudyPlanRequest => ({
  certification: {
    id: 'az-900',
    title: 'Azure Fundamentals',
    vendor: 'Microsoft',
    level: 'Fundamentals',
    description: 'Foundational knowledge of cloud services and how they are provided with Azure.',
    intendedFor: ['Developers new to cloud'],
  },
  preferences: { experienceLevel: 'beginner', weeks: 2, hoursPerWeek: 5, focusNotes: 'Focus on pricing.' },
});

export const samplePlan = (): StudyPlan => ({
  summary: 'Two short weeks covering concepts, then practice.',
  totalWeeks: 2,
  hoursPerWeek: 5,
  prerequisites: ['Basic networking'],
  weeks: [
    { week: 1, theme: 'Cloud concepts', objectives: ['Explain IaaS/PaaS/SaaS'], activities: ['Read the docs'], estimatedHours: 5 },
    { week: 2, theme: 'Practice', objectives: ['Pass a practice exam'], activities: ['Take a practice exam'], estimatedHours: 5 },
  ],
  resources: [{ title: 'Official docs', type: 'official-docs', note: 'Start here.' }],
  examTips: ['Read each question twice.'],
});

export function stubProvider(
  name: ProviderName,
  behavior: { plan?: StudyPlan; error?: unknown },
  model: string | null = `${name}-test-model`,
): StudyPlanProvider & { calls: StudyPlanRequest[] } {
  const calls: StudyPlanRequest[] = [];
  return {
    name,
    model,
    calls,
    async generate(request) {
      calls.push(request);
      if (behavior.error !== undefined) throw behavior.error;
      return behavior.plan ?? samplePlan();
    },
  };
}

export const testConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  isDev: false,
  copilot: { githubToken: undefined, model: undefined },
  gemini: { apiKey: undefined, model: 'gemini-test-model', usesVertexAi: false },
  ...overrides,
});

/** Starts the app on a random local port. Call `close()` when done. */
export async function startApp(options: {
  providers: StudyPlanProvider[];
  /** Replaces the real StudyPlanService (built from `providers`) when set. */
  studyPlans?: AppOptions['studyPlans'];
  config?: AppConfig;
  env?: NodeJS.ProcessEnv;
}) {
  const database = new SqliteStore(':memory:');
  const app = createApp({
    studyPlans: options.studyPlans ?? new StudyPlanService(options.providers),
    auth: new AuthService(database),
    certifications: database,
    config: options.config ?? testConfig(),
    env: options.env ?? {},
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => {
          database.close();
          if (err) reject(err);
          else resolve();
        }),
      ),
  };
}

export function postJson(url: string, body: unknown) {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
