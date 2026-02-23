/**
 * repair-mode.ts
 *
 * Prompt strategy for "make this shippable".
 *
 * Stages run in sequence; each stage produces a focused diff so the LLM
 * stays within MAX_DIFF_SIZE and the diff validator has less to verify.
 *
 * Usage (inside VibeExecutor or a standalone runner):
 *
 *   import { repairPipeline, buildRepairPrompt } from './templates/repair-mode';
 *
 *   for (const stage of repairPipeline) {
 *     const prompt = buildRepairPrompt(stage, repoContext);
 *     const { diff } = await generateDiff(prompt, context);
 *     // apply + preflight as usual
 *   }
 */

import { ProjectContext } from '../context';

// ── Stage definition ──────────────────────────────────────────────────────────

export type RepairStage =
  | 'fix-build'
  | 'ui-consistency'
  | 'loading-empty-states'
  | 'readme';

export interface RepairStageConfig {
  /** Stable identifier used for logging and checkpointing. */
  id: RepairStage;
  /** Short human-readable label shown in the VIBE UI. */
  label: string;
  /**
   * The raw prompt handed to the LLM.
   * Keep imperative and diff-focused — no prose output expected.
   */
  prompt: string;
  /**
   * Preflight commands to verify this stage succeeded.
   * Empty means "trust the diff validator".
   */
  verifyCommands: string[];
  /**
   * When true, abort the pipeline if this stage produces NO_CHANGES.
   * Useful for the build stage: if it can't build it shouldn't continue.
   */
  requiredToProgress: boolean;
}

// ── Ordered pipeline ──────────────────────────────────────────────────────────

export const repairPipeline: RepairStageConfig[] = [
  // ── Stage 1: Fix build ───────────────────────────────────────────────────────
  {
    id: 'fix-build',
    label: 'Fix build errors',
    prompt: `You are a senior engineer performing an emergency build fix.
GOAL: Make the repository compile and pass a basic build check.
RULES:
- Fix ALL TypeScript compile errors, missing imports, and broken exports first.
- Do NOT refactor working code — change only what is broken.
- If a file is causing a circular import, extract the offending type to a shared
  types file rather than deleting it.
- If a dependency is referenced but missing from package.json, use an equivalent
  that is already listed in package.json. Never add new dependencies.
- After applying this diff, \`tsc --noEmit\` must exit 0.
OUTPUT: A valid unified diff. No explanation. No markdown fences.`,
    verifyCommands: ['npx tsc --noEmit'],
    requiredToProgress: true,
  },

  // ── Stage 2: UI consistency ──────────────────────────────────────────────────
  {
    id: 'ui-consistency',
    label: 'Remove UI inconsistencies',
    prompt: `You are a senior front-end engineer performing a UI consistency pass.
GOAL: Make the UI look intentional and consistent throughout the app.
RULES:
- Audit every page/component in the repository context.
- Unify: spacing scale, font sizes, border-radius, colour tokens (use the
  existing Tailwind config / CSS custom properties — do not introduce new ones).
- Remove duplicate or conflicting class names on the same element.
- Ensure every interactive element has a visible focus ring (use outline or
  ring utilities) for accessibility.
- Convert any inline \`style={{}}\` attributes that duplicate Tailwind utilities
  into their Tailwind equivalents.
- Do NOT change business logic, routing, or API calls.
- Do NOT add new pages or components — only fix existing ones.
OUTPUT: A valid unified diff. No explanation. No markdown fences.`,
    verifyCommands: [],
    requiredToProgress: false,
  },

  // ── Stage 3: Loading & empty states ─────────────────────────────────────────
  {
    id: 'loading-empty-states',
    label: 'Add loading and empty states',
    prompt: `You are a senior front-end engineer adding polish to the UI.
GOAL: Every async data-fetch has a loading state and every list/table has an
empty state so the app never shows a blank screen.
RULES:
- For every component that fetches data (look for useEffect + setState / react-query
  / SWR / supabase queries), ensure:
    a) A skeleton loader or spinner is shown while loading === true.
    b) A meaningful empty-state message (with an optional CTA) is shown when
       the data array is empty.
- Use only existing UI primitives (svg spinners, existing Button component, etc.).
  Do NOT introduce new libraries.
- Keep skeleton loaders simple: grey rounded rectangles with an animate-pulse
  class matching the shape of the eventual content.
- Empty-state copy should be friendly and specific to the list it represents
  (e.g. "No invoices yet — create your first one." not "No data.").
- Do NOT change business logic, routing, or API calls.
OUTPUT: A valid unified diff. No explanation. No markdown fences.`,
    verifyCommands: [],
    requiredToProgress: false,
  },

  // ── Stage 4: README ──────────────────────────────────────────────────────────
  {
    id: 'readme',
    label: 'Write README',
    prompt: `You are a senior engineer writing project documentation.
GOAL: Create (or fully rewrite) README.md at the repo root so a new developer
can clone, configure, and run the project in under 10 minutes.
RULES:
- Scan the repository context for: package.json scripts, .env.example,
  docker-compose.yml, Makefile, and any existing documentation files.
- The README MUST include these sections in order:
    1. **Project name + one-sentence description**
    2. **Tech stack** — bullet list (language, framework, database, auth, etc.)
    3. **Prerequisites** — exact versions where possible (Node, Docker, etc.)
    4. **Quick start** — numbered steps (clone → .env setup → install → run)
    5. **Environment variables** — table with Name | Required | Default | Description
    6. **Available scripts** — table or code block listing all npm/make commands
    7. **Architecture overview** — short paragraph or ASCII diagram of services
    8. **Contributing** — branch naming, PR process, and how to run tests
- Use GitHub-flavoured Markdown.
- Do not pad the README with marketing copy — keep it precise and developer-focused.
OUTPUT: A valid unified diff that creates or replaces README.md.
No explanation outside the diff. No markdown fences wrapping the diff itself.`,
    verifyCommands: ['test -f README.md'],
    requiredToProgress: false,
  },
];

// ── Prompt builder ────────────────────────────────────────────────────────────

/**
 * Builds the final LLM user-message for a given repair stage.
 *
 * The stage's base prompt is appended with a focused instruction derived from
 * the repository context so the model understands the project's specific
 * structure before generating the diff.
 *
 * @param stage   The repair stage config from `repairPipeline`.
 * @param context The project context built by context-builder.
 * @param previousError  Optional preflight error from the previous attempt.
 */
export function buildRepairPrompt(
  stage: RepairStageConfig,
  context: ProjectContext,
  previousError?: string,
): string {
  const fileList = Object.keys(context.files)
    .map((p) => `  - ${p}`)
    .join('\n');

  const previousErrorSection = previousError
    ? `\n\n## Previous attempt failed\nThe last diff for this stage failed preflight with:\n${previousError}\nFix the underlying issue — do not just suppress the error.`
    : '';

  return (
    `## Repair stage: ${stage.label}\n\n` +
    `${stage.prompt}${previousErrorSection}\n\n` +
    `## Repository files in context\n${fileList}\n\n` +
    `## Important constraints\n` +
    `- Output ONLY a valid unified diff (git diff format).\n` +
    `- Paths must be relative to the repository root.\n` +
    `- New files use /dev/null as source.\n` +
    `- If no changes are required for this stage, output exactly: NO_CHANGES`
  );
}

// ── Pipeline runner helper ────────────────────────────────────────────────────

export interface RepairStageResult {
  stage: RepairStage;
  label: string;
  status: 'success' | 'skipped' | 'failed' | 'no_changes';
  diff?: string;
  error?: string;
}

/**
 * Iterates the repair pipeline and yields per-stage results.
 * Designed to be called from VibeExecutor — supply the generateDiff and
 * applyAndVerify callbacks to keep this module decoupled from I/O.
 *
 * @param context         Repository context.
 * @param generateDiff    Async function that calls the LLM and returns a diff string.
 * @param applyAndVerify  Async function that applies the diff and runs verifyCommands.
 * @param onProgress      Optional callback for live log streaming.
 */
export async function runRepairPipeline(
  context: ProjectContext,
  generateDiff: (prompt: string, context: ProjectContext, previousError?: string) => Promise<string>,
  applyAndVerify: (diff: string, verifyCommands: string[]) => Promise<{ ok: boolean; error?: string }>,
  onProgress: (stage: RepairStage, message: string) => void = () => {},
): Promise<RepairStageResult[]> {
  const results: RepairStageResult[] = [];

  for (const stage of repairPipeline) {
    onProgress(stage.id, `Starting stage: ${stage.label}`);

    let lastError: string | undefined;
    let stageResult: RepairStageResult = {
      stage: stage.id,
      label: stage.label,
      status: 'failed',
    };

    // Allow up to 2 attempts per stage (initial + one retry on preflight failure)
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) {
        onProgress(stage.id, `Retrying stage after preflight failure (attempt ${attempt})…`);
      }

      let diff: string;
      try {
        const prompt = buildRepairPrompt(stage, context, lastError);
        diff = await generateDiff(prompt, context, lastError);
      } catch (err) {
        stageResult = {
          stage: stage.id,
          label: stage.label,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        };
        onProgress(stage.id, `LLM call failed: ${stageResult.error}`);
        break;
      }

      if (diff.trim() === 'NO_CHANGES') {
        stageResult = { stage: stage.id, label: stage.label, status: 'no_changes' };
        onProgress(stage.id, 'No changes required for this stage.');
        break;
      }

      const { ok, error } = await applyAndVerify(diff, stage.verifyCommands);

      if (ok) {
        stageResult = { stage: stage.id, label: stage.label, status: 'success', diff };
        onProgress(stage.id, `Stage completed successfully.`);
        break;
      }

      lastError = error;
      onProgress(stage.id, `Preflight failed: ${error}`);

      if (attempt === 2) {
        stageResult = { stage: stage.id, label: stage.label, status: 'failed', error, diff };
      }
    }

    results.push(stageResult);

    // Abort pipeline if a required stage did not succeed
    if (
      stage.requiredToProgress &&
      stageResult.status !== 'success' &&
      stageResult.status !== 'no_changes'
    ) {
      onProgress(stage.id, `Required stage "${stage.label}" failed — aborting pipeline.`);
      break;
    }
  }

  return results;
}
