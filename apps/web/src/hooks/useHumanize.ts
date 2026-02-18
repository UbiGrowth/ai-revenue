/**
 * useHumanize Hook
 * React hook for humanizing AI-generated content
 */

import { useState, useCallback } from 'react';
import { humanizeText, type HumanizeOptions } from '@/lib/cmo/humanize';

export function useHumanize() {
  const [isHumanizing, setIsHumanizing] = useState(false);

  const humanize = useCallback(async (
    text: string,
    options?: HumanizeOptions
  ): Promise<string> => {
    if (!text) return text;
    
    setIsHumanizing(true);
    try {
      return await humanizeText(text, options);
    } finally {
      setIsHumanizing(false);
    }
  }, []);

  return { humanize, isHumanizing };
}

/**
 * useAutoHumanize Hook
 * Automatically humanizes content after generation
 */
export function useAutoHumanize(options?: HumanizeOptions) {
  const [rawOutput, setRawOutput] = useState('');
  const [finalOutput, setFinalOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHumanizing, setIsHumanizing] = useState(false);

  const generate = useCallback(async <T extends string>(
    generator: () => Promise<T>
  ): Promise<string> => {
    setIsGenerating(true);
    setRawOutput('');
    setFinalOutput('');

    try {
      // Step 1: Generate raw AI content
      const aiText = await generator();
      setRawOutput(aiText);

      // Step 2: Humanize automatically
      setIsGenerating(false);
      setIsHumanizing(true);
      
      const humanText = await humanizeText(aiText, options);
      setFinalOutput(humanText);
      
      return humanText;
    } catch (error) {
      console.error('Generation/humanization error:', error);
      throw error;
    } finally {
      setIsGenerating(false);
      setIsHumanizing(false);
    }
  }, [options]);

  return {
    rawOutput,
    finalOutput,
    isGenerating,
    isHumanizing,
    isLoading: isGenerating || isHumanizing,
    generate,
    setFinalOutput, // Allow manual edits
  };
}
