# AGENTS.md: Certification-Store

> **Single source of truth for AI coding agents** (Claude Code, GitHub Copilot, Cursor, Codex, and others).
> `CLAUDE.md` and `.github/copilot-instructions.md` only point here. **Edit this file, not those.**
> If you change something this file describes (commands, structure, conventions), update this file in the same change.

## 1. What this project is

An internal web app that shows employees the certification exams currently available to them.

- **Catalog (landing page `/`)**: a panel for each exam, showing title and short description. Panels can be **added and deleted**.
- **Details page (`/certifications/:id`)**: title, full description, and who the certification is intended for.
- **Study plan**: a **Gen AI** study plan generated on the details page. This is a **hard requirement**. Generation uses the **GitHub Copilot SDK first**, with the **Google Gemini SDK (`@google/genai`) as the fallback**.

Status: **rough draft / scaffold**. There is no auth, and the catalog is saved per browser in `localStorage`.

## 2. Repository layout

```
Certification-Store/
├── AGENTS.md                  ← this file (source of truth for agents)
├── CLAUDE.md                  ← pointer to AGENTS.md (Claude Code)
├── .github/copilot-instructions.md  ← pointer to AGENTS.md (GitHub Copilot)
├── .github/workflows/pr-check.yml   ← CI: server typecheck and tests on PRs into develop (advisory, see §10)
├── .githooks/pre-push         ← server checks before every push: blocks pushes to develop, warns otherwise (core.hooksPath)
├── docs/plans/                ← multi-session plans (testing-and-ci-guard.md)
├── README.md                  ← human-facing overview and setup
├── package.json               ← root scripts only (concurrently)
├── client/                    ← Angular 21 SPA
│   ├── proxy.conf.json        ← dev proxy: /api → http://localhost:3000
│   ├── .npmrc                 ← legacy-peer-deps=true (see Gotchas)
│   └── src/
│       ├── styles/tokens.css  ← design tokens (--cs-*): the only place colors are defined
│       ├── styles.scss        ← global base styles and shared utility classes
│       └── app/
│           ├── app.ts|html|scss, app.config.ts, app.routes.ts
│           ├── core/
│           │   ├── models/    ← certification.ts, study-plan.ts
│           │   ├── data/      ← seed-certifications.ts (default catalog)
│           │   └── services/  ← certification.store.ts, study-plan.api.ts, theme.service.ts
│           └── features/
│               ├── catalog/               ← catalog-page, certification-card, certification-form
│               ├── certification-detail/  ← certification-detail-page
│               └── study-plan/            ← study-plan-generator, study-plan-view
└── server/                    ← Node/Express 5 BFF (TypeScript, ESM)
    ├── .env.example           ← copy to .env (never commit .env)
    ├── .npmrc                 ← legacy-peer-deps=true (see Gotchas)
    ├── tsconfig.build.json    ← build config: excludes *.spec.ts and src/test/ from dist
    └── src/
        ├── app.ts             ← createApp(): routes (GET /api/health, POST /api/study-plan) and error handler, no side effects
        ├── index.ts           ← entry point: builds the real providers, calls createApp, listens, handles shutdown
        ├── *.spec.ts          ← Vitest specs (app.spec.ts, study-plan.service.spec.ts)
        ├── test/helpers.ts    ← stub providers, sample request/plan, startApp() on a random port
        ├── config.ts          ← env loading (process.loadEnvFile)
        ├── schema.ts          ← Zod request/response schemas (API contract)
        ├── prompt.ts          ← system prompt and user prompt builder
        ├── study-plan.service.ts  ← provider chain: tries each in order, returns first success
        └── providers/
            ├── study-plan-provider.ts  ← StudyPlanProvider interface
            ├── copilot.provider.ts     ← primary (@microsoft/copilot-sdk)
            └── gemini.provider.ts      ← fallback (@google/genai)
```

## 3. Commands

Requirements: **Node ≥ 22.12** (developed on 22.23), npm 10. Windows is the primary dev OS; scripts must stay cross-platform.

| Task | Command (from repo root unless noted) |
|---|---|
| Install everything | `npm run install:all` (also enables the pre-push hook via `npm run hooks:install`) |
| Run app and API (dev) | `npm run dev` (API on `:3000`, app on `http://localhost:4200`) |
| Build both | `npm run build` |
| Test | `npm test` (client Vitest, server typecheck, server Vitest) |
| Client only | `cd client && npm start`, `npm test -- --watch=false`, `npx ng build` |
| Server only | `cd server && npm run dev`, `npm run typecheck`, `npm test`, `npm run build` |
| Health check | `curl http://localhost:4200/api/health` (through the proxy) |

**Before you call a task done:** `npm test` passes, `cd client && npx ng build` has no errors **or warnings** (budgets included), and `cd server && npm run typecheck && npm test` is clean. The server checks are the same ones CI runs on every PR into `develop`.

## 4. Architecture and data flow

```
Angular (browser) ── POST /api/study-plan ──▶ Express BFF ──▶ 1. CopilotStudyPlanProvider
       ▲                                           │           2. GeminiStudyPlanProvider (fallback)
       └────────── StudyPlanResponse ◀─────────────┘
```

- The **browser never sees API keys.** Keys live only in `server/.env`. Never add keys, tokens or AI SDK calls to `client/`.
- **AI assistants must never read secrets files.** No AI agent (Claude Code, Copilot, Cursor, Codex, others) may open, read, search, print, copy or summarize `.env` or `.env.*` files (any directory) or any other file holding credentials, keys or tokens. The only exception is `.env.example`, which holds placeholders only. This covers `cat`/`type`/`Get-Content`, grep/search tools, IDE attachments, and `process.env` dumps. If you need to know whether a variable is set, ask the human, or write code that reports only *whether* it is set, never its value. Never echo secrets into logs, chat, commits or error messages. If you find a real secret in any file you did read, stop and tell the human so they can rotate it. To debug credentials without reading secrets, call `GET /api/health` in dev: it reports only booleans (`tokenConfigured`, `apiKeyConfigured`), provider order and model names, never values. The provider details are returned only when `NODE_ENV` is not `production` (production returns just `{ status: 'ok' }`), so production deployments must set `NODE_ENV=production`. Never extend this endpoint to return secret values, even masked or partial. This is enforced for Claude Code in `.claude/settings.json` (deny rules); other tools must honor it by policy, and the human should also add their own ignore config (for example Copilot content exclusion, `.cursorignore`).
- The catalog lives on the client, so the client **sends the certification details with each study-plan request**. The server validates every request with `StudyPlanRequestSchema` (Zod) and caps the body at 32 kB. Error codes: invalid request or malformed JSON → **400**, body over 32 kB → **413**, all providers failed → **502**, anything else → **500** with a generic message (details are only logged).
- `StudyPlanService` tries the providers in order and returns `{ plan, provider, model, fallbackReason?, generatedAt }`. If every provider fails, the server responds **502** with `{ failures: [{ provider, reason }] }`.
- The study-plan **output contract** is `StudyPlanSchema` in `server/src/schema.ts`. `client/src/app/core/models/study-plan.ts` mirrors it by hand. **When you change one, change the other in the same commit.**

## 5. AI provider rules (read before touching `server/src/providers/`)

### GitHub Copilot SDK (primary)
- Package: **`@microsoft/copilot-sdk`** (v2). `@github/copilot-sdk` is **deprecated**, so don't add it.
- Runs only in Node: it drives the Copilot runtime over JSON-RPC. The Windows runtime comes from the optional package `@microsoft/copilot-sdk-win32-x64`.
- Pattern: share one lazily started `CopilotClient({ mode: 'coding-agent', github: { token } })`, create a **new session per request**, and call `session.sendAndWait({ prompt }, StudyPlanSchema, timeoutMs)`. Always `session.disconnect()` in `finally`.
- Sessions run with **`tools: { availableTools: [] }`**, which allows pure text generation only. Don't enable shell, file, web or MCP tools in this path.
- Auth: `GITHUB_TOKEN` from `.env`. If it's empty, the SDK uses the locally logged-in GitHub/Copilot user, which is fine for dev and not for production.
- Don't guess SDK APIs. Check the type definitions in `server/node_modules/@microsoft/copilot-sdk/dist/*.d.ts`.

### Google Gemini (fallback)
- Package: **`@google/genai`** (Google Gen AI SDK, v3). `@google/generative-ai` is the **legacy** SDK, so don't add it.
- Default model **`gemini-3.5-flash-lite`** (stable, recommended by Google for price and performance), set by `GEMINI_MODEL`. Don't change the default unless asked. The `gemini-2.x` models are deprecated or shut down.
- Call: `ai.models.generateContent({ model, contents, config: { systemInstruction, responseMimeType: 'application/json', responseJsonSchema, abortSignal } })`. The JSON Schema comes from `z.toJSONSchema(StudyPlanSchema)` with `$schema` removed.
- Gemini enforces only a **subset of JSON Schema**, so the response is **always** re-validated with `StudyPlanSchema.safeParse`. Keep the schema simple: no `min`/`max` length constraints and no deep nesting.
- Check `promptFeedback.blockReason` and `candidates[0].finishReason` (`STOP` is the only success; `MAX_TOKENS`, `SAFETY` and others mean failure) before reading `response.text`.
- Auth: `GEMINI_API_KEY` (Gemini Developer API / AI Studio). If it's unset, the SDK reads `GOOGLE_API_KEY`, or uses **Vertex AI** when `GOOGLE_GENAI_USE_VERTEXAI=true` with `GOOGLE_CLOUD_PROJECT`/`GOOGLE_CLOUD_LOCATION` and Application Default Credentials. No code change is needed to switch.
- Errors: map `ApiError` from `@google/genai` by `status` in `describeError()`, never by matching message text. The timeout uses `AbortSignal.timeout(AI_TIMEOUT_MS)`.
- Don't guess SDK APIs. Check `server/node_modules/@google/genai/dist/node/node.d.ts`.

### Prompting
- Edit prompts only in `server/src/prompt.ts`.
- User-supplied text (certification fields, learner notes) is wrapped in XML tags and treated as **data, not instructions**. Keep it that way.
- The model must not invent URLs, prices, exam codes or statistics. The system prompt says so; keep that rule.
- **Adding a provider:** implement `StudyPlanProvider`, then add it to the list in `server/src/index.ts`. The order of that list is the fallback order.

## 6. Client conventions (Angular 21)

- **Standalone components only** (no NgModules). Use `inject()`, not constructor injection.
- **Signals for state**: `signal`, `computed`, `effect`, `input()` / `input.required()`, `output()`, `viewChild()`. The app is **zoneless**, so don't rely on zone.js.
- Every component sets `changeDetection: ChangeDetectionStrategy.OnPush`.
- Templates use **built-in control flow** (`@if`, `@for` with `track`, `@else`), not `*ngIf`/`*ngFor`.
- Forms use **Reactive Forms** with `NonNullableFormBuilder`. Signal Forms are experimental in v21; don't use them yet.
- Routing: lazy `loadComponent`. Route params bind to inputs via `withComponentInputBinding()` (for example `id = input.required<string>()`).
- HTTP goes through services in `core/services/` with `provideHttpClient(withFetch())`. Components never call `HttpClient` directly.
- **File naming follows the Angular v20+ style guide**: `catalog-page.ts`, `certification-card.ts` (no `.component` suffix). Class names omit the `Component` suffix (`CatalogPage`, `CertificationCard`). Selector prefix is `app-`.
- Small components may use inline templates and styles. Pages use separate `.html` and `.scss` files.
- Catalog state lives in `CertificationStore` (signals plus `localStorage` key `cs.certifications.v1`). Every `localStorage` access is wrapped in try/catch.

### Styling and theming
- **Never hard-code colors.** Use the semantic tokens from `src/styles/tokens.css`: `--cs-color-*` for color, `--cs-space-*`, `--cs-radius-*`, `--cs-shadow-*`, `--cs-text-*` for everything else. Use raw palette steps (`--cs-purple-600`) only for decoration such as gradients.
- Theme switching: `ThemeService` sets `data-theme="light|dark"` on `<html>`. "System" removes the attribute so `prefers-color-scheme` applies. New tokens need values for **both** themes, in both dark blocks.
- Reuse the global utility classes in `styles.scss` (`.btn`, `.btn--primary|ghost|danger|sm`, `.panel`, `.field`, `.input`, `.chip`, `.chip--accent|neutral`, `.alert--error|info|warning`, `.container`, `.muted`, `.visually-hidden`) before writing new component CSS.
- **Accessibility is required:** text contrast ≥ 4.5:1 and UI contrast ≥ 3:1 (the current tokens are verified), visible `:focus-visible`, a label for every input, `aria-live` for async status, and no reliance on hover alone.
- The component style budget is 6 kB (warning) / 12 kB (error). Move shared styles to `styles.scss`.

## 7. Server conventions

- **ESM + NodeNext**: relative imports **must include the `.js` extension** (`import { x } from './schema.js'`).
- Strict TypeScript. Zod is the validation layer for every request body.
- Read configuration only through `config.ts`, which handles the env vars. Add new variables to `.env.example` as well.
- Express 5: thrown errors in async handlers reach the error middleware. Never return stack traces or secrets to clients. `describeError()` produces client-safe messages. The error middleware passes body-parser 4xx errors through with fixed messages (400, 413) and turns everything else into a generic 500.
- Keep `app.ts` free of side effects: no `listen`, no `config.ts` import (type-only imports are fine), no provider construction. Those belong in `index.ts`, so tests can build the app with stubs.

## 8. Testing

- Client: Vitest via `ng test` (jsdom). Specs sit next to the source as `*.spec.ts`. Cover any new service logic, for example `certification.store.spec.ts`.
- Server: Vitest (`cd server && npm test`). Specs sit next to the source as `*.spec.ts`. Shared helpers live in `src/test/helpers.ts`. HTTP tests use `startApp()` (the app on a random local port) with plain `fetch`, no `supertest`. Providers are **always stubs** (`stubProvider()`): never import `copilot.provider.ts` or `gemini.provider.ts` in a test, and never load `.env`.
- Server tests are **behavior checks**: they record what the API does today (status codes, response shapes, fallback order, no secret values in `/api/health`). If a change breaks one, either the change is wrong or the behavior change is intended. In the second case, update the test in the same commit and say so in the PR description. Don't weaken or delete a test just to get green.
- New server behavior (a route, a provider, an error mapping) comes with a spec.
- Don't make real Copilot or Gemini calls in automated tests or CI. They cost money, use quota, and need credentials.

## 9. Gotchas

- **npm 10.9 crash** in `client/` and `server/` (`Cannot read properties of null (reading 'edgesOut')`): fixed by `.npmrc` → `legacy-peer-deps=true` in each. Don't delete those files. CI's `npm ci` relies on the server one too.
- **Git hooks** live in `.githooks/` and must keep LF line endings (`.gitattributes`) and the executable bit (`git update-index --chmod=+x`).
- **Don't use `npm install --prefix <dir>`** from the repo root. npm then adds the root package as a `"certification-store": "file:.."` dependency. Use `cd <dir> && npm install`.
- **Line endings:** the main developer is on Windows (`core.autocrlf=true`). The "LF will be replaced by CRLF" warnings are expected.
- **Ports:** 3000 (API) and 4200 (app). The proxy is set up only for `ng serve`. A production deployment needs a reverse proxy, or the API must serve the built client.

## 10. Git and collaboration

- `develop` is the default branch. Branch from `develop`, open PRs into `develop`, keep commits small and focused, and use imperative commit subjects (for example "Add certification search filter").
- **Never commit** `.env`, keys or tokens, `node_modules/`, `dist/` or `.angular/`.
- Agents: don't commit, push or open PRs unless a human asks. Don't add dependencies without saying why.
- **PR check (advisory).** `.github/workflows/pr-check.yml` runs the server typecheck and tests on every PR into `develop` and every push to it. The repo is private on GitHub Free, so GitHub can't block a red merge; the rule is a team agreement: **don't merge a PR while "PR check" is red or still running.** Agents must never merge PRs (denied for Claude Code in `.claude/settings.json`), never suggest merging a red PR, and never bypass hooks with `--no-verify`.
- The `pre-push` hook (`.githooks/pre-push`, enabled by `npm run hooks:install`) runs the same checks locally, so failures show up before CI. If they fail, it **blocks** a push to `develop` (direct pushes skip the PR check) and only **warns** for any other branch, so work-in-progress can still be pushed.
- **Agents: treat the hook's warning as a failure.** If a push prints "server checks FAILED", fix it before calling the task done, and say so in your reply. The leniency is for humans pushing work in progress, not for agents.
- When several AI tools work on the same repo, this file is the shared contract. Put decisions that affect every agent here, not in tool-specific files.

## 11. Known gaps and roadmap (don't "fix" these silently; ask first)

- No authentication or roles: anyone can add or delete. Planned: company SSO and an admin role.
- Catalog persistence is per browser. Planned: `/api/certifications` backed by a real store (swap `load`/`persist` in `CertificationStore`).
- Generated study plans aren't saved.
- Client and server study-plan types are duplicated. A shared package is a candidate.
- Copilot production hardening: `mode: 'empty'` with an explicit `runtime.baseDirectory` and a service token.
- CI covers only the server. Client tests in CI are planned (see §12).

## 12. Active plans

- **Tests and the PR check:** [`docs/plans/testing-and-ci-guard.md`](./docs/plans/testing-and-ci-guard.md) holds the decisions, checklist and progress log. Read it before changing tests, CI or hooks, and update it when you make progress.
