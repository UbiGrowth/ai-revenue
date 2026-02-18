/**
 * Tests for gc_rate_limit_counters SQL function
 * 
 * This function cleans up old rate limit counter rows:
 * - minute windows older than 1 day
 * - hour windows older than 7 days
 * - day windows older than 30 days
 * - legacy rows (null window_type) older than 30 days
 * 
 * Run with:
 * TEST_GC_RATE_LIMITS=true npx vitest run src/test/gc-rate-limit-counters.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nyzgsizvtqhafoxixyrd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests unless explicitly enabled
const shouldRunTests = process.env.TEST_GC_RATE_LIMITS === 'true';

// Type for rate_limit_counters table rows
interface RateLimitCounter {
  id: number;
  key: string;
  window_start: string;
  window_type: string | null;
  count: number;
  created_at: string | null;
  updated_at: string | null;
}

describe.skipIf(!shouldRunTests)('gc_rate_limit_counters function', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: SupabaseClient<any, 'public', any>;
  const testKeyPrefix = `gc_test_${Date.now()}`;

  beforeAll(() => {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for GC tests');
    }
    
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  });

  afterAll(async () => {
    // Clean up any remaining test rows
    if (supabase) {
      await supabase
        .from('rate_limit_counters')
        .delete()
        .like('key', `${testKeyPrefix}%`);
    }
  });

  describe('Scenario A - Old windows deleted', () => {
    it('should delete minute windows older than 1 day', async () => {
      const testKey = `${testKeyPrefix}_minute_old`;
      
      // Insert a minute window from 2 days ago
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          window_type: 'minute',
          count: 5
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row is deleted
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('should delete hour windows older than 7 days', async () => {
      const testKey = `${testKeyPrefix}_hour_old`;
      
      // Insert an hour window from 8 days ago
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          window_type: 'hour',
          count: 10
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row is deleted
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('should delete day windows older than 30 days', async () => {
      const testKey = `${testKeyPrefix}_day_old`;
      
      // Insert a day window from 31 days ago
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
          window_type: 'day',
          count: 100
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row is deleted
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('should delete legacy rows (null window_type) older than 30 days', async () => {
      const testKey = `${testKeyPrefix}_legacy_old`;
      
      // Insert a legacy row from 31 days ago with null window_type
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
          window_type: null,
          count: 50
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row is deleted
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('should delete all old windows in a single GC call', async () => {
      const testKeys = {
        minute: `${testKeyPrefix}_all_minute`,
        hour: `${testKeyPrefix}_all_hour`,
        day: `${testKeyPrefix}_all_day`
      };
      
      // Insert all three types of old windows
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert([
          {
            key: testKeys.minute,
            window_start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            window_type: 'minute',
            count: 5
          },
          {
            key: testKeys.hour,
            window_start: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            window_type: 'hour',
            count: 10
          },
          {
            key: testKeys.day,
            window_start: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
            window_type: 'day',
            count: 100
          }
        ]);
      
      expect(insertError).toBeNull();
      
      // Run GC once
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify all rows are deleted
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .in('key', Object.values(testKeys));
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  describe('Scenario B - Fresh windows preserved', () => {
    it('should preserve minute windows younger than 1 day', async () => {
      const testKey = `${testKeyPrefix}_minute_fresh`;
      
      // Insert a minute window from 10 minutes ago
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          window_type: 'minute',
          count: 5
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row still exists
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].count).toBe(5);
      
      // Clean up
      await supabase.from('rate_limit_counters').delete().eq('key', testKey);
    });

    it('should preserve hour windows younger than 7 days', async () => {
      const testKey = `${testKeyPrefix}_hour_fresh`;
      
      // Insert an hour window from 1 day ago
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          window_type: 'hour',
          count: 10
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row still exists
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].count).toBe(10);
      
      // Clean up
      await supabase.from('rate_limit_counters').delete().eq('key', testKey);
    });

    it('should preserve day windows younger than 30 days', async () => {
      const testKey = `${testKeyPrefix}_day_fresh`;
      
      // Insert a day window from 5 days ago
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          window_type: 'day',
          count: 100
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row still exists
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].count).toBe(100);
      
      // Clean up
      await supabase.from('rate_limit_counters').delete().eq('key', testKey);
    });

    it('should preserve all fresh windows in a single GC call', async () => {
      const testKeys = {
        minute: `${testKeyPrefix}_fresh_minute`,
        hour: `${testKeyPrefix}_fresh_hour`,
        day: `${testKeyPrefix}_fresh_day`
      };
      
      // Insert all three types of fresh windows
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert([
          {
            key: testKeys.minute,
            window_start: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
            window_type: 'minute',
            count: 5
          },
          {
            key: testKeys.hour,
            window_start: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            window_type: 'hour',
            count: 10
          },
          {
            key: testKeys.day,
            window_start: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
            window_type: 'day',
            count: 100
          }
        ]);
      
      expect(insertError).toBeNull();
      
      // Run GC once
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify all rows still exist
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .in('key', Object.values(testKeys));
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(3);
      
      // Clean up
      await supabase.from('rate_limit_counters').delete().in('key', Object.values(testKeys));
    });
  });

  describe('Edge cases', () => {
    it('should handle boundary conditions for minute windows (exactly 1 day)', async () => {
      const testKey = `${testKeyPrefix}_minute_boundary`;
      
      // Insert a minute window from exactly 1 day ago (should be preserved)
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert({
          key: testKey,
          window_start: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          window_type: 'minute',
          count: 5
        });
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Verify row still exists (boundary should be preserved)
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .eq('key', testKey);
      
      expect(selectError).toBeNull();
      // At exactly 1 day, should still exist (< not <=)
      expect(data).toHaveLength(1);
      
      // Clean up
      await supabase.from('rate_limit_counters').delete().eq('key', testKey);
    });

    it('should handle mixed old and fresh windows correctly', async () => {
      const testKeys = {
        oldMinute: `${testKeyPrefix}_mixed_old_minute`,
        freshMinute: `${testKeyPrefix}_mixed_fresh_minute`,
        oldHour: `${testKeyPrefix}_mixed_old_hour`,
        freshHour: `${testKeyPrefix}_mixed_fresh_hour`
      };
      
      // Insert mix of old and fresh windows
      const { error: insertError } = await supabase
        .from('rate_limit_counters')
        .insert([
          {
            key: testKeys.oldMinute,
            window_start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            window_type: 'minute',
            count: 5
          },
          {
            key: testKeys.freshMinute,
            window_start: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            window_type: 'minute',
            count: 3
          },
          {
            key: testKeys.oldHour,
            window_start: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            window_type: 'hour',
            count: 20
          },
          {
            key: testKeys.freshHour,
            window_start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            window_type: 'hour',
            count: 15
          }
        ]);
      
      expect(insertError).toBeNull();
      
      // Run GC
      const { error: gcError } = await supabase.rpc('gc_rate_limit_counters');
      expect(gcError).toBeNull();
      
      // Check which rows remain
      const { data, error: selectError } = await supabase
        .from('rate_limit_counters')
        .select('*')
        .in('key', Object.values(testKeys));
      
      expect(selectError).toBeNull();
      expect(data).toHaveLength(2);
      
      const remainingKeys = data!.map(row => row.key);
      expect(remainingKeys).toContain(testKeys.freshMinute);
      expect(remainingKeys).toContain(testKeys.freshHour);
      expect(remainingKeys).not.toContain(testKeys.oldMinute);
      expect(remainingKeys).not.toContain(testKeys.oldHour);
      
      // Clean up
      await supabase.from('rate_limit_counters').delete().in('key', Object.values(testKeys));
    });
  });
});
