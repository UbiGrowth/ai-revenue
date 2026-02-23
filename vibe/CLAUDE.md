# CLAUDE.md - AI Assistant Guide for VIBE

## Project Overview

VIBE is an AI-powered code generation and automation platform. It accepts natural language prompts, generates unified diffs via LLM (OpenAI GPT-4), applies them to repositories with strict validation, runs CI-parity preflight checks, and creates GitHub pull requests automatically.

## Repository Structure

This is a **monorepo** using npm workspaces (`apps/*`):

```
VIBE/
├── apps/
│   ├── api/          # Backend REST API (Express + NestJS, TypeScript)
│   ├── executor/     # LLM execution engine (TypeScript, OpenAI SDK)
│   └── web/          # Frontend UI (React 18, Vite, Tailwind CSS)
├── tests/            # End-to-end tests
├── scripts/          # Utility shell scripts (create-project, list-projects)
├── data/             # Runtime data (repos, worktrees, SQLite DB, patches)
├── docker-compose.yml
├── Makefile
├── package.json      # Root workspace config
└── .env.example      # Environment variable template
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API | Express 4 + NestJS 11, TypeScript, better-sqlite3 |
| Executor | TypeScript, OpenAI SDK, simple-git, Octokit |
| Web | React 18, React Router 7, Vite 5, Tailwind CSS |
| Database | SQLite (via better-sqlite3) |
| Runtime | Node.js 20 |
| Containers | Docker Compose (3 services: api, executor, web) |

## Common Commands

### Development

```bash
# Run all services concurrently (API + Executor + Web)
npm run dev

# Run individual services
npm run dev:api         # API on port 3001 (tsx watch)
npm run dev:executor    # Executor with hot reload (tsx watch)
npm run dev:web         # Web dev server via Vite

# Build all workspaces
npm run build
```

### Testing

```bash
# Executor unit tests (Node.js built-in test runner via tsx)
cd apps/executor && npx tsx --test src/**/*.test.ts

# End-to-end tests
npm run test:e2e
```

### Docker

```bash
make up       # docker compose up -d
make down     # docker compose down
make health   # Check API (port 3001) and Web (port 3000) health
```

## Architecture

### Execution Flow

1. **API** receives a job request (`POST /jobs`) with a prompt and project ID
2. **Executor** polls for queued tasks from the SQLite database
3. Executor syncs the project's cached repo (`/data/repos/`) and creates an isolated git worktree (`/data/worktrees/`)
4. **Context builder** scans the repo using ripgrep to build LLM context
5. **LLM call** (OpenAI GPT-4, temperature=0) generates a unified diff
6. **Diff validator** performs multi-layer validation and sanitization
7. Diff is applied to the worktree with pre-apply sanity checks
8. **Preflight pipeline** conditionally runs configured stages (lint, typecheck, test, smoke) — stages are skipped when their env vars are not set
9. On success, a **GitHub PR** is created via Octokit (skipped for local-only projects without a remote)

### Key Services

- **API** (`apps/api/src/index.ts`): REST endpoints for projects and jobs, NestJS bootstrap with Express routes, SQLite storage layer
- **Executor** (`apps/executor/src/index.ts`): `VibeExecutor` class polls for tasks, orchestrates the full pipeline (context → LLM → validate → apply → preflight → PR)
- **Web** (`apps/web/src/`): React SPA with glass-morphism dark theme UI, live log streaming via Server-Sent Events (SSE)

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/projects` | Create project from template |
| `POST` | `/projects/import/github` | Import GitHub repository |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/:id` | Get project details |
| `DELETE` | `/projects/:id` | Delete project |
| `POST` | `/jobs` | Create a new job/task |
| `GET` | `/jobs` | List recent tasks |
| `GET` | `/jobs/:id` | Get task status |
| `GET` | `/jobs/:id/logs` | SSE stream of job logs |
| `GET` | `/health` | Health check |

### Data Storage

- **SQLite database**: `./data/vibe.db` — stores projects, tasks, and events
- **Repo cache**: `/data/repos/` — persistent bare/cloned repositories per project
- **Worktrees**: `/data/worktrees/` — isolated git worktrees per job execution
- **Patches**: `/data/patches/` — failed patches saved for debugging

## Code Conventions

### TypeScript

- **Strict mode** enabled across all workspaces (`"strict": true`)
- **Target**: ES2022 for API and Executor, ES2020 for Web
- **Module system**: CommonJS for API and Executor, ESNext for Web (Vite)
- API uses NestJS decorators (`experimentalDecorators`, `emitDecoratorMetadata`)
- Web enforces `noUnusedLocals` and `noUnusedParameters`

### Testing

- Uses **Node.js built-in test runner** (`node:test` module) — not Jest or Mocha
- Test files are colocated with source: `*.test.ts` alongside the module they test
- E2E tests are in `tests/e2e/`
- Test imports: `import { describe, it, before, after } from 'node:test'` and `import assert from 'node:assert'`
- Executor tests are excluded from TypeScript compilation (`"exclude": ["**/*.test.ts"]` in tsconfig)

### File Organization

- Each app has `src/` as the root source directory, compiled to `dist/`
- API entry point: `apps/api/src/index.ts`
- Executor entry point: `apps/executor/src/index.ts`
- Web entry point: `apps/web/src/main.tsx`
- Database/storage logic centralized in `apps/api/src/storage.ts`
- Executor modules are split by responsibility: `context-builder.ts`, `diff-validator.ts`, `llm.ts`, `preflight.ts`, `github-client.ts`, `git-url.ts`

### Style

- No dedicated linter or formatter configuration files (no .eslintrc, .prettierrc)
- Console logging with contextual prefixes (e.g., `console.log('VIBE Executor started')`)
- Error handling via try-catch with structured event logging to SQLite
- Environment configuration via `dotenv` loading from repo root

## Environment Variables

Key variables (see `.env.example` for the full list):

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key for LLM calls | Required |
| `GITHUB_TOKEN` | GitHub PAT for PR creation (repo scope) | Required for PRs |
| `API_PORT` | API server port | `3001` |
| `EXECUTOR_POLL_INTERVAL` | Task polling interval (ms) | `5000` |
| `MAX_ITERATIONS` | Max LLM retry iterations per task | `6` |
| `MAX_CONTEXT_SIZE` | Max repo context size (chars) | `50000` |
| `MAX_DIFF_SIZE` | Max diff size (chars) | `5000` |
| `DATABASE_PATH` | SQLite database file path | `./data/vibe.db` |
| `LINT_COMMAND` | Preflight lint command | Not set (stage skipped) |
| `TYPECHECK_COMMAND` | Preflight typecheck command | Not set (stage skipped) |
| `TEST_COMMAND` | Preflight test command | Not set (stage skipped) |
| `SMOKE_COMMAND` | Preflight smoke test command | Not set (stage skipped) |
| `PREFLIGHT_TIMEOUT` | Preflight timeout (ms) | `300000` |

## Important Patterns

### Project-Centric Architecture (Mode A)

The platform uses a project-centric model where repositories are persistently cached at `/data/repos/` and each job gets an isolated git worktree at `/data/worktrees/`. This avoids re-cloning and provides clean execution environments.

### Diff Validation

Diffs go through multi-layer validation before being applied:
1. `normalizeLLMOutput()` — cleans raw LLM output
2. `extractDiff()` — extracts unified diff from response
3. `sanitizeUnifiedDiff()` — fixes common LLM diff errors
4. `validateUnifiedDiff()` / `validateUnifiedDiffEnhanced()` — structural validation
5. `validateDiffApplicability()` — verifies the diff can apply to the target files
6. `performPreApplySanityChecks()` — final safety checks before application

See `HUNK_LINE_VALIDATION.md` for the detailed diff validation specification.

### LLM Configuration

- Uses OpenAI GPT-4 with `temperature=0` for deterministic output
- Retry logic with fallback modes for failed diff generation
- Anthropic Claude SDK (`@anthropic-ai/sdk`) is included as a dependency but not the primary LLM

### Preflight Pipeline

Conditional CI-parity checks run in sequence after applying a diff. Only stages with their environment variable set are executed — unconfigured stages are skipped entirely:
1. **Lint** (`LINT_COMMAND`) — only runs if `LINT_COMMAND` env var is set
2. **Typecheck** (`TYPECHECK_COMMAND`) — only runs if `TYPECHECK_COMMAND` env var is set
3. **Test** (`TEST_COMMAND`) — only runs if `TEST_COMMAND` env var is set
4. **Smoke** (`SMOKE_COMMAND`) — only runs if `SMOKE_COMMAND` env var is set

If no preflight env vars are configured, the entire preflight phase is skipped with a success result. All stages share a configurable timeout (`PREFLIGHT_TIMEOUT`).

### Web UI Design System

The frontend uses a glass-morphism dark theme with these conventions:
- **Background**: Dark gradient (`#1a1035` → `#0f0f23` → `#0a0a1a`)
- **Cards**: `.glass-card` utility — `rgba(255,255,255,0.06)` background, `blur(12px)` backdrop, `1px solid rgba(255,255,255,0.1)` border, `16px` border-radius
- **Colors**: `vibe-blue` (#3B82F6), `vibe-purple` (#8B5CF6), `vibe-pink` (#EC4899) used in gradients
- **Components**: Button (3 variants), Header, Sidebar (collapsible), StatusPipeline, LogEntry (4 severities), ProjectCard
- **Pages**: Home (hero + prompt input + project grid) and TaskView (split layout: details+pipeline | live logs)
- **Routing**: BrowserRouter with `/` (Home) and `/task/:taskId` (TaskView)
- **Real-time**: SSE via `useJobLogs` hook for live log streaming, 3s polling for task status
