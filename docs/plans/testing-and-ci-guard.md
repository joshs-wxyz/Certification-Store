# Plan: server tests and a PR check on `develop`

Goal: changes (AI-assisted or not) can't quietly break the current backend behavior, while new features stay easy to add.

Agents: start here at the beginning of a session on this topic. Continue from the first unchecked task, and update the checklist and progress log as you go.

## Decisions

| # | Decision | Date |
|---|---|---|
| A1 | Scope is the **server only** for now. Client tests can become a second CI job later. | 2026-11-24 |
| A2 | Tests are shallow behavior checks of the HTTP API and the provider chain. AI providers are always **stubs**; tests never import the Copilot or Gemini providers or read `.env`. | 2026-11-24 |
| A3 | Test runner: **Vitest** (per AGENTS.md §8). HTTP calls use **plain `fetch`** against `app.listen(0)`; no `supertest`. | 2026-11-24 |
| A4 | Fix the error handler bug first: malformed JSON must return **400** and an oversized body **413** (both returned 500). Tests check the corrected codes. | 2026-11-24 |
| A5 | CI: one GitHub Actions job on `ubuntu-latest` for `pull_request` and `push` on `develop`: `npm ci`, typecheck, tests. No secrets in the workflow. No `paths:` filter. | 2026-11-24 |
| A6 | No "convert PR to draft on failure" step. | 2026-11-24 |
| A7 | The repo stays **private on GitHub Free**. GitHub can't require status checks there, so CI is advisory. Protection comes from: the CI ✓/✗ on every PR, a local pre-push hook, an AGENTS.md rule, and a Claude Code deny rule for `gh pr merge`. Don't push toward a paid plan unless the owner asks. | 2026-11-24 |

## Checklist

- [x] Split `server/src/index.ts` into `app.ts` (`createApp`, routes and middleware, no side effects) and `index.ts` (real providers, `listen`, shutdown).
- [x] Fix the error handler: pass through 4xx errors from the body parser (400 malformed JSON, 413 too large) with client-safe messages.
- [x] Add Vitest to `server/` (`npm test` → `vitest run`) and a `tsconfig.build.json` that keeps specs out of `dist/`.
- [x] Write the tests: health (prod and dev, no secret values), study-plan success, fallback, all-fail 502, validation 400, malformed JSON 400, oversized 413, non-JSON body 400, `x-powered-by` absent, `describeError` mapping and truncation.
- [x] Add `.github/workflows/pr-check.yml`.
- [x] Add `.githooks/pre-push` and wire `core.hooksPath` into `npm run install:all`.
- [x] Root `npm test` also runs the server tests.
- [x] AGENTS.md: commands, layout, testing, merge rule, §12 pointer. README: scripts and contributing.
- [x] Claude Code deny rule for `gh pr merge`.
- [ ] Owner: push the branch, open a PR into `develop`, and confirm the "PR check" workflow runs and goes green.
- [ ] Later (optional): client Vitest as a second CI job.
- [ ] Later (optional): a test that the client `study-plan.ts` model still matches `StudyPlanSchema`.

## Progress log

- **2026-11-24**: Plan agreed (A1–A7). Implemented every task above except the owner's check that the workflow runs on GitHub.
- **2026-11-24**: Committed on branch `chore/server-tests-and-pr-check` (3 commits) and pushed. The PR into `develop` is opened from the GitHub web UI (no `gh` CLI on the dev machine).
