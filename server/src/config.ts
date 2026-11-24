// Loads `.env` (if present) using Node's built-in loader - no dotenv dependency needed.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file - rely on the real process environment.
}

const emptyToUndefined = (value: string | undefined) => (value && value.trim() !== '' ? value.trim() : undefined);

export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  aiTimeoutMs: Number(process.env['AI_TIMEOUT_MS'] ?? 120_000),
  copilot: {
    githubToken: emptyToUndefined(process.env['GITHUB_TOKEN']),
    model: emptyToUndefined(process.env['COPILOT_MODEL']),
  },
  claude: {
    apiKey: emptyToUndefined(process.env['ANTHROPIC_API_KEY']),
    model: emptyToUndefined(process.env['CLAUDE_MODEL']) ?? 'claude-opus-5-5',
  },
} as const;
