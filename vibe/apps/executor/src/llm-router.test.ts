/**
 * llm-router test suite
 *
 * Uses CJS Module._load interception (compatible with tsx --test) to stub out
 * @anthropic-ai/sdk, openai, and ./storage before requiring the module under
 * test.  No external packages need to be installed.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Module from 'module';

// ── Spy containers ────────────────────────────────────────────────────────────
const anthropicCalls: any[] = [];
const openaiCalls: any[]    = [];
const logEventCalls: Array<[string, string, string]> = [];

// ── Stub factories ────────────────────────────────────────────────────────────
class MockAnthropic {
  messages = {
    create: async (params: any) => {
      anthropicCalls.push(params);
      return {
        content: [{ type: 'text', text: 'diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1 +1 @@\n-old\n+new' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      };
    },
  };
}

class MockOpenAI {
  chat = {
    completions: {
      create: async (params: any) => {
        openaiCalls.push(params);
        return {
          choices: [{ message: { content: 'diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1 +1 @@\n-old\n+new' } }],
          usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
        };
      },
    },
  };
}

const mockStorage = {
  logEvent: (taskId: string, message: string, severity: string) => {
    logEventCalls.push([taskId, message, severity]);
  },
};

// ── Intercept require() before the module is first loaded ─────────────────────
const originalLoad = (Module as any)._load.bind(Module);
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
  // __esModule: true prevents tsx's __importDefault from double-wrapping the default export
  if (request === '@anthropic-ai/sdk') return { __esModule: true, default: MockAnthropic };
  if (request === 'openai')            return { __esModule: true, default: MockOpenAI };
  if (request === './storage' || request === './storage.js')
    return { storage: mockStorage };
  return originalLoad(request, parent, isMain);
};

// Clear the cached module (in case it was already loaded) so our stubs apply
delete (require as any).cache[(require as any).resolve('./llm-router')];

// Now import the module under test
const { generateDiff } = require('./llm-router');

// ── Restore after the suite ───────────────────────────────────────────────────
after(() => {
  (Module as any)._load = originalLoad;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function reset() {
  anthropicCalls.length = 0;
  openaiCalls.length    = 0;
  logEventCalls.length  = 0;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('llm-router: module shape', () => {
  it('exports generateDiff as a function', () => {
    assert.strictEqual(typeof generateDiff, 'function');
  });
});

describe('llm-router: claude routing', () => {
  before(reset);

  it('calls Anthropic SDK with claude-sonnet-4-5-20250929', async () => {
    reset();
    await generateDiff('add a log line', 'repo context', { model: 'claude', taskId: 't1' });
    assert.strictEqual(anthropicCalls.length, 1, 'Anthropic.messages.create called once');
    assert.strictEqual(anthropicCalls[0].model, 'claude-sonnet-4-5-20250929');
  });

  it('does NOT call OpenAI when model is claude', async () => {
    reset();
    await generateDiff('task', 'ctx', { model: 'claude', taskId: 't2' });
    assert.strictEqual(openaiCalls.length, 0, 'OpenAI must not be called');
  });

  it('returns diff text and correct usage tokens', async () => {
    reset();
    const result = await generateDiff('fix', 'ctx', { model: 'claude', taskId: 't3' });
    assert.ok(result.diff.length > 0, 'diff non-empty');
    assert.strictEqual(result.usage.input_tokens, 10);
    assert.strictEqual(result.usage.output_tokens, 5);
    assert.strictEqual(result.usage.total_tokens, 15);
  });
});

describe('llm-router: gpt routing', () => {
  it('calls OpenAI SDK with gpt-4-turbo-preview', async () => {
    reset();
    await generateDiff('add types', 'ctx', { model: 'gpt', taskId: 't4' });
    assert.strictEqual(openaiCalls.length, 1, 'OpenAI.chat.completions.create called once');
    assert.strictEqual(openaiCalls[0].model, 'gpt-4-turbo-preview');
  });

  it('does NOT call Anthropic when model is gpt', async () => {
    reset();
    await generateDiff('task', 'ctx', { model: 'gpt', taskId: 't5' });
    assert.strictEqual(anthropicCalls.length, 0, 'Anthropic must not be called');
  });

  it('returns diff text and correct usage tokens', async () => {
    reset();
    const result = await generateDiff('fix', 'ctx', { model: 'gpt', taskId: 't6' });
    assert.ok(result.diff.length > 0, 'diff non-empty');
    assert.strictEqual(result.usage.input_tokens, 20);
    assert.strictEqual(result.usage.output_tokens, 8);
    assert.strictEqual(result.usage.total_tokens, 28);
  });

  it('sends system prompt as role=system and user content as role=user', async () => {
    reset();
    await generateDiff('task', 'ctx', { model: 'gpt', taskId: 't7' });
    const msgs: any[] = openaiCalls[0].messages;
    assert.strictEqual(msgs[0].role, 'system');
    assert.ok((msgs[0].content as string).includes('unified diff'), 'system prompt contains "unified diff"');
    assert.strictEqual(msgs[1].role, 'user');
  });
});

describe('llm-router: storage.logEvent', () => {
  it('logs model, input_tokens, output_tokens, latency for claude', async () => {
    reset();
    await generateDiff('fix', 'ctx', { model: 'claude', taskId: 'log-c' });
    const entry = logEventCalls.find(([tid]) => tid === 'log-c');
    assert.ok(entry, 'logEvent called for task log-c');
    assert.match(entry![1], /claude-sonnet-4-5-20250929/);
    assert.match(entry![1], /input_tokens=10/);
    assert.match(entry![1], /output_tokens=5/);
    assert.match(entry![1], /latency=\d+ms/);
    assert.strictEqual(entry![2], 'info');
  });

  it('logs model, input_tokens, output_tokens, latency for gpt', async () => {
    reset();
    await generateDiff('fix', 'ctx', { model: 'gpt', taskId: 'log-g' });
    const entry = logEventCalls.find(([tid]) => tid === 'log-g');
    assert.ok(entry, 'logEvent called for task log-g');
    assert.match(entry![1], /gpt-4-turbo-preview/);
    assert.match(entry![1], /input_tokens=20/);
    assert.match(entry![1], /output_tokens=8/);
    assert.match(entry![1], /latency=\d+ms/);
    assert.strictEqual(entry![2], 'info');
  });
});

describe('llm-router: user message construction', () => {
  it('includes context and prompt in the user message', async () => {
    reset();
    await generateDiff('add a button', 'MY REPO CONTEXT', { model: 'claude', taskId: 'msg-1' });
    const userContent: string = anthropicCalls[0].messages[0].content;
    assert.ok(userContent.includes('MY REPO CONTEXT'), 'context in user message');
    assert.ok(userContent.includes('add a button'), 'prompt in user message');
  });

  it('appends previousError when provided', async () => {
    reset();
    await generateDiff('fix', 'ctx', { model: 'claude', taskId: 'msg-2' }, 'HUNK MISMATCH ERROR');
    const userContent: string = anthropicCalls[0].messages[0].content;
    assert.ok(userContent.includes('HUNK MISMATCH ERROR'), 'previousError injected');
  });

  it('does not add error section when previousError is absent', async () => {
    reset();
    await generateDiff('fix', 'ctx', { model: 'claude', taskId: 'msg-3' });
    const userContent: string = anthropicCalls[0].messages[0].content;
    assert.ok(!userContent.includes('HUNK MISMATCH ERROR'), 'no error section in user message');
  });
});
