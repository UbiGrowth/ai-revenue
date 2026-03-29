import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { storage } from './storage';

const SYSTEM_PROMPT = `You are a code modification assistant. You MUST output ONLY a unified diff or the token NO_CHANGES.

STRICT OUTPUT REQUIREMENTS:
- NO prose, explanations, markdown formatting, or code blocks are allowed
- Output must start with "diff --git" (for diffs) OR be exactly "NO_CHANGES"
- Every diff block MUST have "---" and "+++" headers
- Every diff block MUST have "@@ ... @@" hunk markers
- The diff must be directly applicable with 'git apply'

ALLOWED OUTPUTS:
1. A valid unified diff starting with "diff --git a/... b/..."
2. The single token "NO_CHANGES"

ANY OTHER OUTPUT WILL BE REJECTED.`;

export interface RouterDiffResult {
  diff: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export async function generateDiff(
  prompt: string,
  context: string,
  options: { model: 'claude' | 'gpt'; taskId: string },
  previousError?: string
): Promise<RouterDiffResult> {
  const startTime = Date.now();

  let userMessage = `${context}\n\n---\n\nUSER REQUEST: ${prompt}\n\nGenerate a unified diff to implement this request. Output ONLY the diff, nothing else.`;
  if (previousError) {
    userMessage += `\n\n---\n\n${previousError}`;
  }

  let text: string;
  let usage: { input_tokens: number; output_tokens: number; total_tokens: number };
  let modelName: string;

  if (options.model === 'claude') {
    modelName = 'claude-sonnet-4-5-20250929';
    const client = new Anthropic();
    const response = await client.messages.create({
      model: modelName,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
    usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  } else {
    modelName = 'gpt-4-turbo-preview';
    const client = new OpenAI();
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: 4096,
    });
    text = response.choices[0]?.message?.content || '';
    const u = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    usage = {
      input_tokens: u.prompt_tokens,
      output_tokens: u.completion_tokens,
      total_tokens: u.total_tokens,
    };
  }

  const latencyMs = Date.now() - startTime;
  storage.logEvent(
    options.taskId,
    `LLM call complete: model=${modelName} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens} latency=${latencyMs}ms`,
    'info'
  );

  return { diff: text.trim(), usage };
}
