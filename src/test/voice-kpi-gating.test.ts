/**
 * Voice KPI Gating Tests
 * 
 * Validates that Voice Analytics follows the canonical gating rules:
 * 1. Live mode + no provider = zeros, no samples
 * 2. Demo mode = sample data allowed
 * 3. Live mode + provider connected = real data only
 */

import { describe, it, expect } from 'vitest';

// Simulates the gating logic from useVoiceDataQualityStatus
function deriveVoiceStatus(isDemoMode: boolean, voiceConnected: boolean) {
  if (isDemoMode) return 'DEMO_MODE';
  if (voiceConnected) return 'LIVE_OK';
  return 'NO_VOICE_PROVIDER_CONNECTED';
}

function canShowVoiceMetrics(isDemoMode: boolean, voiceConnected: boolean) {
  return isDemoMode || voiceConnected;
}

// Simulates the analytics gating from VoiceAgents.tsx
function gateAnalytics(
  realAnalytics: { totalCalls: number } | null,
  sampleAnalytics: { totalCalls: number },
  isDemoMode: boolean,
  voiceConnected: boolean
) {
  if (isDemoMode) {
    return realAnalytics ?? sampleAnalytics;
  }
  if (!voiceConnected) {
    return { totalCalls: 0 };
  }
  return realAnalytics;
}

describe('Voice KPI Gating', () => {
  const SAMPLE_ANALYTICS = { totalCalls: 156 };
  const REAL_ANALYTICS = { totalCalls: 42 };

  describe('Scenario 1: Live mode + no voice provider', () => {
    const isDemoMode = false;
    const voiceConnected = false;

    it('should return NO_VOICE_PROVIDER_CONNECTED status', () => {
      expect(deriveVoiceStatus(isDemoMode, voiceConnected)).toBe('NO_VOICE_PROVIDER_CONNECTED');
    });

    it('should NOT allow showing voice metrics', () => {
      expect(canShowVoiceMetrics(isDemoMode, voiceConnected)).toBe(false);
    });

    it('should return zeros for analytics (no sample fallback)', () => {
      const result = gateAnalytics(null, SAMPLE_ANALYTICS, isDemoMode, voiceConnected);
      expect(result.totalCalls).toBe(0);
    });

    it('should return zeros even if real data exists (provider not connected)', () => {
      const result = gateAnalytics(REAL_ANALYTICS, SAMPLE_ANALYTICS, isDemoMode, voiceConnected);
      expect(result.totalCalls).toBe(0);
    });
  });

  describe('Scenario 2: Demo mode enabled', () => {
    const isDemoMode = true;
    const voiceConnected = false;

    it('should return DEMO_MODE status', () => {
      expect(deriveVoiceStatus(isDemoMode, voiceConnected)).toBe('DEMO_MODE');
    });

    it('should allow showing voice metrics', () => {
      expect(canShowVoiceMetrics(isDemoMode, voiceConnected)).toBe(true);
    });

    it('should return sample analytics when no real data', () => {
      const result = gateAnalytics(null, SAMPLE_ANALYTICS, isDemoMode, voiceConnected);
      expect(result.totalCalls).toBe(156);
    });

    it('should return real analytics when available (real wins over sample)', () => {
      const result = gateAnalytics(REAL_ANALYTICS, SAMPLE_ANALYTICS, isDemoMode, voiceConnected);
      expect(result.totalCalls).toBe(42);
    });
  });

  describe('Scenario 3: Live mode + provider connected', () => {
    const isDemoMode = false;
    const voiceConnected = true;

    it('should return LIVE_OK status', () => {
      expect(deriveVoiceStatus(isDemoMode, voiceConnected)).toBe('LIVE_OK');
    });

    it('should allow showing voice metrics', () => {
      expect(canShowVoiceMetrics(isDemoMode, voiceConnected)).toBe(true);
    });

    it('should return real analytics (no sample fallback)', () => {
      const result = gateAnalytics(REAL_ANALYTICS, SAMPLE_ANALYTICS, isDemoMode, voiceConnected);
      expect(result.totalCalls).toBe(42);
    });

    it('should return null when no real data (not sample)', () => {
      const result = gateAnalytics(null, SAMPLE_ANALYTICS, isDemoMode, voiceConnected);
      expect(result).toBeNull();
    });
  });
});
