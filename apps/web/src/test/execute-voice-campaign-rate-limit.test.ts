/**
 * Execute-Voice-Campaign Rate Limit Integration Tests
 * 
 * Tests rate limiting for execute-voice-campaign endpoint (userId + IP keyed)
 * Limits: 10/min, 50/hr, 200/day
 * 
 * Prerequisites:
 * - Set TEST_AUTH_TOKEN_U1 env var (valid JWT for user 1)
 * - Set TEST_AUTH_TOKEN_U2 env var (valid JWT for user 2)
 * 
 * Run with:
 * TEST_RATE_LIMITS=true TEST_AUTH_TOKEN_U1=xxx TEST_AUTH_TOKEN_U2=xxx npx vitest run src/test/execute-voice-campaign-rate-limit.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  callEdgeFunction,
  callEdgeFunctionNTimes,
  countByStatus,
  generateTestId,
  sleep,
  RATE_LIMITS,
} from "./rate-limit-utils";

const shouldRun = process.env.TEST_RATE_LIMITS === "true";
const authTokenU1 = process.env.TEST_AUTH_TOKEN_U1;
const authTokenU2 = process.env.TEST_AUTH_TOKEN_U2;

describe.skipIf(!shouldRun || !authTokenU1)("Execute-Voice-Campaign Rate Limit Tests", () => {
  const limits = RATE_LIMITS["execute-voice-campaign"]; // 10/min, 50/hr, 200/day
  const endpoint = "execute-voice-campaign";

  /**
   * Per-minute limit test
   * Call 11 times - first 10 should pass, 11th should 429
   */
  describe("Per-minute limit", () => {
    const testIp = "10.10.10.1";

    it("should enforce per-minute limit of 10 requests", async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;
      const requestCount = limits.perMinute + 1; // 11 requests

      const results = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { 
            assetId: `test-asset-${generateTestId()}`, 
            assistantId: "test-assistant" 
          },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        requestCount,
        50
      );

      const statusCounts = countByStatus(results);

      // Assert: At least one 429 response
      expect(statusCounts[429] || 0).toBeGreaterThan(0);

      // Assert: First 10 should not be 429
      const first10 = results.slice(0, limits.perMinute);
      const first10RateLimited = first10.filter((r) => r.status === 429).length;
      expect(first10RateLimited).toBe(0);

      console.log("Per-minute limit results:", statusCounts);
    });
  });

  /**
   * Key isolation - Different user test
   * After U1 is throttled, U2 from same IP should work
   */
  describe.skipIf(!authTokenU2)("Key isolation - Different user", () => {
    const testIp = "10.10.10.2";

    it("should allow requests from different user on same IP", async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;

      // First exhaust limit for U1
      await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { 
            assetId: `test-asset-${generateTestId()}`, 
            assistantId: "test-assistant" 
          },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 3,
        30
      );

      // Now send requests as U2 from same IP
      const u2Results = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { 
            assetId: `test-asset-${generateTestId()}`, 
            assistantId: "test-assistant" 
          },
          authToken: authTokenU2,
          overrideIp: uniqueIp,
        },
        5,
        50
      );

      const statusCounts = countByStatus(u2Results);

      // Assert: All from U2 should NOT be 429
      expect(statusCounts[429] || 0).toBe(0);

      console.log("Different user results (U2):", statusCounts);
    });
  });

  /**
   * Key isolation - Different IP test
   * After IP1 is throttled for U1, different IP should still work for U1
   */
  describe("Key isolation - Different IP", () => {
    const ip1 = "10.10.10.3";
    const ip2 = "10.10.10.4";

    it("should allow requests from same user on different IP", async () => {
      const uniqueIp1 = `${ip1}-${generateTestId()}`;
      const uniqueIp2 = `${ip2}-${generateTestId()}`;

      // First exhaust limit for U1 on IP1
      await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { 
            assetId: `test-asset-${generateTestId()}`, 
            assistantId: "test-assistant" 
          },
          authToken: authTokenU1,
          overrideIp: uniqueIp1,
        },
        limits.perMinute + 3,
        30
      );

      // Now send requests as U1 from IP2
      const ip2Results = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { 
            assetId: `test-asset-${generateTestId()}`, 
            assistantId: "test-assistant" 
          },
          authToken: authTokenU1,
          overrideIp: uniqueIp2,
        },
        5,
        50
      );

      const statusCounts = countByStatus(ip2Results);

      // Assert: All from IP2 should NOT be 429
      expect(statusCounts[429] || 0).toBe(0);

      console.log("Different IP results:", statusCounts);
    });
  });

  /**
   * Window reset test
   */
  describe("Window reset", () => {
    const testIp = "10.10.10.5";

    it("should allow requests after minute window resets", { timeout: 120000 }, async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;

      // Exhaust limit
      const initialResults = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { 
            assetId: `test-asset-${generateTestId()}`, 
            assistantId: "test-assistant" 
          },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 3,
        30
      );

      const initialStatusCounts = countByStatus(initialResults);
      expect(initialStatusCounts[429] || 0).toBeGreaterThan(0);

      console.log("Before wait:", initialStatusCounts);
      console.log("Waiting 65 seconds for window reset...");
      await sleep(65000);

      // Request after reset
      const afterResetResult = await callEdgeFunction({
        functionName: endpoint,
        body: { 
          assetId: `test-asset-${generateTestId()}`, 
          assistantId: "test-assistant" 
        },
        authToken: authTokenU1,
        overrideIp: uniqueIp,
      });

      expect(afterResetResult.status).not.toBe(429);
      console.log("After wait status:", afterResetResult.status);
    });
  });

  /**
   * 429 Response format verification
   */
  describe("429 Response Format", () => {
    it("should include proper error structure", async () => {
      const uniqueIp = `format-${generateTestId()}`;

      const results = await callEdgeFunctionNTimes(
        {
          functionName: endpoint,
          body: { 
            assetId: `test-asset-${generateTestId()}`, 
            assistantId: "test-assistant" 
          },
          authToken: authTokenU1,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 3,
        30
      );

      const rateLimitedResponse = results.find((r) => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();

      const data = rateLimitedResponse?.data as Record<string, unknown>;
      expect(data.error).toBe("Rate limit exceeded");
      expect(data.limitExceeded).toBe("minute");
      expect(data.retryAfter).toBe(60);
      expect(rateLimitedResponse?.retryAfter).toBe(60);
    });
  });
});
