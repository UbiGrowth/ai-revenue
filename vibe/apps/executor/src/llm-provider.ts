import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
}

export interface LLMProvider {
  readonly name: string;
  generate(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<LLMResponse>;
}

class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(model?: string) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model || 'gpt-4-turbo-preview';
  }

  async generate(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
    });
    
    const text = response.choices[0]?.message?.content || '';
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    return {
      text,
      usage: {
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    };
  }
}

class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(model?: string) {
    this.client = new Anthropic();
    this.model = model || 'claude-sonnet-4-5-20250929';
  }

  async generate(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
    
    return {
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}

class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private model: string;

  constructor(model?: string) {
    this.model = model || 'gemini-pro';
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
    let mod: any;
    try {
      mod = require('@google/generative-ai');
    } catch {
      throw new Error(
        'Gemini provider requires @google/generative-ai package. Run: npm install @google/generative-ai'
      );
    }
    const genAI = new mod.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const text = result.response.text();
    
    // Gemini doesn't always provide usage data in the same way
    const usageMetadata = result.response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    
    return {
      text,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
    };
  }
}

export function createLLMProvider(provider?: string, model?: string): LLMProvider {
  const p = provider || process.env.LLM_PROVIDER || 'openai';
  switch (p) {
    case 'anthropic':
    case 'claude':
      return new AnthropicProvider(model);
    case 'gemini':
    case 'google':
      return new GeminiProvider(model);
    case 'openai':
    default:
      return new OpenAIProvider(model);
  }
}
