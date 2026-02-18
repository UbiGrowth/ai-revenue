/**
 * Humanization Layer
 * De-robotizes AI-generated content to sound more natural
 */

import { supabase } from "@/integrations/supabase/client";

export interface HumanizeOptions {
  tone?: 'conversational' | 'professional' | 'casual' | 'friendly';
  preserveKeywords?: string[];
  targetAudience?: string;
}

export interface HumanizeResult {
  text: string;
  changes?: string[];
}

/**
 * Humanize AI-generated text to sound more natural
 */
export async function humanizeText(
  raw: string,
  options?: HumanizeOptions
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-cmo-humanize', {
    body: {
      text: raw,
      tone: options?.tone || 'conversational',
      preserveKeywords: options?.preserveKeywords,
      targetAudience: options?.targetAudience,
    },
  });

  if (error) {
    console.error('Humanization error:', error);
    // Fallback to original text if humanization fails
    return raw;
  }

  return data?.text || raw;
}

/**
 * Hook helper for humanization with loading state
 */
export function createHumanizer() {
  let isHumanizing = false;

  return {
    humanize: async (raw: string, options?: HumanizeOptions): Promise<string> => {
      isHumanizing = true;
      try {
        return await humanizeText(raw, options);
      } finally {
        isHumanizing = false;
      }
    },
    get isHumanizing() {
      return isHumanizing;
    },
  };
}
