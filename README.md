# Certification-Store (rough draft)

An internal Angular 21 app that lists the certification exams currently available to employees and generates a personalised Gen AI study plan for each one.

```
Certification-Store/
├── client/   Angular 21 SPA (standalone components, signals, zoneless, Vitest)
├── server/   Node/Express 5 BFF: holds the API keys and runs the Gen AI providers
└── package.json   root scripts (runs both together with `concurrently`)
```

> **Working with AI coding tools?** [`AGENTS.md`](./AGENTS.md) is the single source of truth for agent context. `CLAUDE.md` (Claude Code) and `.github/copilot-instructions.md` (GitHub Copilot) both point to it. Update `AGENTS.md` only.

## Features

| Area | What it does |
|---|---|
| **Catalog (landing page)** | Shows a panel for every available exam, with its title and short description. The sample catalog loads on first visit. |
| **Add / delete** | "+ Add certification" opens an inline form. Each panel has a Delete button that asks for confirmation inline. All changes are saved to `localStorage`. |
| **Details page** | `/certifications/:id` shows the title, full description, and who the certification is intended for. |
| **Study plan (Gen AI)** | You enter your experience level, the weeks you have, hours per week, and optional notes. The server returns a structured week-by-week plan with resources and exam tips. |
| **Theme** | Purple-centric design tokens with light and dark modes (System → Light → Dark toggle in the header). |

## Architecture

```
Browser (Angular) ──POST /api/study-plan──▶ Express BFF ──▶ 1) GitHub Copilot SDK  (@microsoft/copilot-sdk)
        ▲                                         │        2) Google Gemini SDK  (@google/genai) ← fallback
        └──────────── StudyPlanResponse ◀─────────┘
```

- **API keys stay on the server.** They are read from `server/.env` and never sent to the browser. In development the Angular dev server proxies `/api` to `http://localhost:3000` (`client/proxy.conf.json`).
- **Provider chain:** `StudyPlanService` tries Copilot first. If Copilot throws for any reason (auth, timeout, invalid output), the service logs the reason and retries with Gemini. The response says which provider produced the plan, and the UI shows a notice when the fallback was used. If both fail, the server returns `502` with the reason from each provider.
- **The same schema for both providers:** one Zod schema (`server/src/schema.ts`) validates the output of both.
  - Copilot: `session.sendAndWait({ prompt }, StudyPlanSchema, timeout)` returns a parsed, typed object. The session runs with **no tools** enabled (`tools.availableTools: []`), so it is pure text generation with no shell, file, or web access.
  - Gemini: `ai.models.generateContent()` with `responseMimeType: 'application/json'` and a `responseJsonSchema` generated from the same Zod schema (`z.toJSONSchema`). Gemini enforces only a subset of JSON Schema, so the result is always re-validated with Zod. The default model is `gemini-3.5-flash-lite`. Responses that were blocked or cut short (`blockReason`, or a `finishReason` other than `STOP`) count as failures.
- **Prompt-injection hygiene:** certification text and the learner's notes are wrapped in XML tags. The system prompt tells the model to treat them as data. The request body is validated with Zod and size-limited (32 kB).

## Getting started

Requirements: Node `>= 22.12` (Node 22.23 tested). The Copilot runtime ships as a platform package (`@microsoft/copilot-sdk-win32-x64` was installed automatically).

```powershell
cd Certification-Store
npm run install:all                     # root + server + client
Copy-Item server/.env.example server/.env   # then fill in the keys
npm run dev                             # API on :3000, app on http://localhost:4200
```

### `server/.env`

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | GitHub token for an account or org with a Copilot license. **If empty, the SDK uses the locally logged-in GitHub/Copilot CLI user**, which is handy for local development. |
| `COPILOT_MODEL` | Optional Copilot model id. If empty, the Copilot runtime's default model is used. |
| `GEMINI_API_KEY` | Gemini Developer API key (from Google AI Studio) for the fallback. |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash-lite`. |
| `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` | Optional: use Vertex AI (Application Default Credentials) instead of an API key. Leave `GEMINI_API_KEY` empty. |
| `AI_TIMEOUT_MS` | Timeout per provider (default `120000`). |

`GET /api/health` reports which credentials are configured. It never returns their values.

## Scripts

| Where | Command | What |
|---|---|---|
| root | `npm run dev` | server (tsx watch) and client (`ng serve`) together |
| root | `npm run build` | `tsc` for the server and `ng build` for the client |
| root | `npm test` | client unit tests (Vitest), server typecheck, server tests (Vitest) |
| root | `npm run hooks:install` | enables the pre-push hook (already part of `install:all`) |
| client | `npm test` | Vitest via `ng test` |
| server | `npm test` | Vitest: API and provider-chain behavior with stubbed AI providers (no keys, no network) |

## Contributing

- Branch from `develop` and open pull requests into `develop`.
- There is no GitHub CI: tests run locally only, so nothing uses GitHub Actions minutes. **Don't merge a PR unless `npm test` passes locally on its branch.**
- The pre-push hook runs the server typecheck and tests before you push. On a feature branch a failure only prints a warning, so you can still push work in progress. A push straight to `develop` is blocked until the checks pass. Don't get around it with `--no-verify`.
- If a change is meant to alter API behavior, update the matching test in the same PR and say so in the description.

## Notes and known gaps (draft scope)

- **Copilot SDK package:** `@github/copilot-sdk` is deprecated on npm in favor of **`@microsoft/copilot-sdk` v2**, so this draft uses v2.
- **npm quirk:** in `client/`, npm 10.9 crashes on a peer-dependency bug (`Cannot read properties of null (reading 'edgesOut')`). `client/.npmrc` sets `legacy-peer-deps=true` to work around it.
- **Persistence** is per-browser (`localStorage`). Moving to a shared catalog only requires replacing `load`/`persist` in `CertificationStore` with HTTP calls to a new `/api/certifications` endpoint.
- **No auth or roles yet.** Anyone can add or delete entries. Company SSO and an admin role are the natural next step.
- **Copilot server-mode hardening:** the draft uses client `mode: "coding-agent"` with tools disabled. For a multi-user deployment, consider `mode: "empty"` with an explicit `runtime.baseDirectory` and a dedicated service token.
- **Study plans aren't saved.** Regenerating replaces the plan in view. Caching or saving plans per user would need a backend store.
- The client and server models are duplicated (`client/src/app/core/models/study-plan.ts` and `server/src/schema.ts`). A shared package could remove the duplication later.

## Design tokens

`client/src/styles/tokens.css` came from a color-theory research pass. It uses a triadic-leaning scheme: a violet primary (OKLCH hue 300), a deep-teal accent (hue 195), purple-tinted neutrals, and status colors tuned to sit next to purple. Every text pair was computed at ≥ 4.5:1 contrast and every UI pair at ≥ 3:1 (WCAG 2.2) in both light and dark themes. All tokens use the `--cs-` prefix.
