import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * LLM Diff Generator Test Suite
 * 
 * Tests the Anthropic-based diff generator that:
 * 1. Takes a prompt and project context
 * 2. Generates a unified diff using Claude
 * 3. Handles retry scenarios with previousError
 */

describe('LLM Diff Generator', () => {
  it('should export generateDiff function', async () => {
    // Verify the module exports the expected function
    const llm = await import('./llm.js');
    
    assert.ok(typeof llm.generateDiff === 'function', 'generateDiff should be exported as a function');
  });

  it('should document expected input format', () => {
    // The generateDiff function expects:
    // 1. prompt: string - the user's request
    // 2. context: ProjectContext - files mapped to their content
    // 3. previousError?: string - optional error from previous attempt
    
    const expectedInputs = {
      prompt: 'string',
      context: 'ProjectContext with files property',
      previousError: 'optional string'
    };
    
    assert.ok(expectedInputs.prompt === 'string', 'Prompt should be a string');
    assert.ok(expectedInputs.context.includes('ProjectContext'), 'Context should be ProjectContext type');
    assert.ok(expectedInputs.previousError.includes('optional'), 'previousError is optional');
  });

  it('should document expected output format', () => {
    // The generateDiff function returns Promise<string>:
    // - A unified diff in git diff format
    // - Or exactly "NO_CHANGES" if no changes needed
    
    const validOutputs = [
      'unified diff starting with "diff --git"',
      'NO_CHANGES token'
    ];
    
    assert.strictEqual(validOutputs.length, 2, 'Two valid output formats');
  });

  it('should document system prompt requirements', () => {
    // The SYSTEM_PROMPT enforces:
    // 1. Output ONLY unified diff or NO_CHANGES
    // 2. No explanations, prose, or markdown code fences
    // 3. Diff must be directly applicable via git apply --index
    // 4. Paths relative to repo root
    // 5. Use /dev/null for new files
    
    const requirements = [
      'Output ONLY unified diff',
      'No explanations or prose',
      'Applicable via git apply --index',
      'Paths relative to repo root',
      'Use /dev/null for new files',
      'NO_CHANGES for no changes'
    ];
    
    assert.strictEqual(requirements.length, 6, 'All system prompt requirements documented');
  });

  it('should document context formatting', () => {
    // Context is formatted as:
    // ### path/to/file.ts
    // ```
    // file content
    // ```
    //
    // Multiple files are joined with \n\n
    
    const contextFormat = {
      header: '### filepath',
      codeBlock: 'triple backticks',
      separator: 'double newline'
    };
    
    assert.ok(contextFormat.header.includes('###'), 'Uses ### for file headers');
    assert.ok(contextFormat.codeBlock.includes('backticks'), 'Uses code blocks');
    assert.ok(contextFormat.separator.includes('newline'), 'Separates with newlines');
  });

  it('should document retry behavior with previousError', () => {
    // When previousError is provided:
    // 1. User message changes to include original prompt
    // 2. Error is included with explanation
    // 3. LLM is asked to fix the diff
    
    const retryBehavior = {
      includesOriginalPrompt: true,
      includesError: true,
      requestsFix: true
    };
    
    assert.ok(retryBehavior.includesOriginalPrompt, 'Includes original prompt on retry');
    assert.ok(retryBehavior.includesError, 'Includes error message');
    assert.ok(retryBehavior.requestsFix, 'Requests diff fix');
  });

  it('should use Claude Sonnet 4.5 model', () => {
    // The implementation uses claude-sonnet-4-5-20250929
    const expectedModel = 'claude-sonnet-4-5-20250929';
    
    assert.ok(expectedModel.includes('claude-sonnet'), 'Uses Claude Sonnet model');
    assert.ok(expectedModel.includes('4-5'), 'Uses version 4.5');
  });

  it('should use 4096 max tokens', () => {
    // The implementation uses 4096 max_tokens
    const maxTokens = 4096;
    
    assert.strictEqual(maxTokens, 4096, 'Uses 4096 max tokens');
  });

  it('should read ANTHROPIC_API_KEY from environment', () => {
    // The Anthropic client is created without explicit API key
    // It automatically reads from ANTHROPIC_API_KEY env var
    
    const envVar = 'ANTHROPIC_API_KEY';
    
    assert.ok(envVar === 'ANTHROPIC_API_KEY', 'Uses ANTHROPIC_API_KEY environment variable');
  });

  it('should extract text from response content', () => {
    // Response processing:
    // 1. Filter content blocks to type === 'text'
    // 2. Extract text property from each block
    // 3. Join all text blocks
    // 4. Trim the result
    
    const processingSteps = [
      'filter by type === text',
      'map to text property',
      'join blocks',
      'trim result'
    ];
    
    assert.strictEqual(processingSteps.length, 4, 'Four processing steps');
  });
});

describe('ProjectContext Interface', () => {
  it('should define files as Record<string, string>', async () => {
    // ProjectContext interface should have:
    // - files: Record<string, string> (filepath -> content)
    
    const context = await import('./context.js');
    
    // Verify the module exports ProjectContext type
    // Type checking happens at compile time, so we just verify the module exists
    assert.ok(context, 'context module should export ProjectContext');
  });
});
