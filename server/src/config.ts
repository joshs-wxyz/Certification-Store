// Loads `.env` (if present) using Node's built-in loader - no dotenv dependency needed.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file - rely on the real process environment.
}

const emptyToUndefined = (value: string | undefined) => (value && value.trim() !== '' ? value.trim() : undefined);

export const config = {
  /** Dev unless NODE_ENV=production. Gates diagnostics that must not be public. */
  isDev: process.env['NODE_ENV'] !== 'production',
  port: Number(process.env['PORT'] ?? 3000),
  aiTimeoutMs: Number(process.env['AI_TIMEOUT_MS'] ?? 120_000),
  copilot: {
    githubToken: emptyToUndefined(process.env['GITHUB_TOKEN']),
    model: emptyToUndefined(process.env['COPILOT_MODEL']),
  },
  gemini: {
    /** Optional: when unset, @google/genai reads GEMINI_API_KEY / GOOGLE_API_KEY or Vertex AI env vars itself. */
    apiKey: emptyToUndefined(process.env['GEMINI_API_KEY']),
    model: emptyToUndefined(process.env['GEMINI_MODEL']) ?? 'gemini-3.5-flash-lite',
    usesVertexAi: process.env['GOOGLE_GENAI_USE_VERTEXAI']?.toLowerCase() === 'true',
  },
} as const;
