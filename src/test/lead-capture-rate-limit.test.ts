/**
 * Lead-Capture Rate Limit Integration Tests
 * 
 * Tests rate limiting for lead-capture endpoint (workspaceId + IP keyed)
 * 
 * Prerequisites:
 * - Set LEAD_CAPTURE_WEBHOOK_SECRET env var
 * - Set TEST_WORKSPACE_ID env var (valid workspace)
 * - Set TEST_WORKSPACE_PASSWORD env var (if workspace has password)
 * 
 * Run with:
 * TEST_RATE_LIMITS=true LEAD_CAPTURE_WEBHOOK_SECRET=xxx TEST_WORKSPACE_ID=xxx npx vitest run src/test/lead-capture-rate-limit.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  callLeadCapture,
  callLeadCaptureNTimes,
  countByStatus,
  generateTestId,
  sleep,
  RATE_LIMITS,
} from "./rate-limit-utils";

// Skip tests by default - run manually with TEST_RATE_LIMITS=true
const shouldRun = process.env.TEST_RATE_LIMITS === "true";
const testWorkspaceId = process.env.TEST_WORKSPACE_ID || generateTestId();
const testWorkspacePassword = process.env.TEST_WORKSPACE_PASSWORD || "";

describe.skipIf(!shouldRun)("Lead-Capture Rate Limit Tests", () => {
  const limits = RATE_LIMITS["lead-capture"];

  /**
   * Scenario A – Under limit
   * Send 10 requests with valid HMAC + workspace password
   * All should return 2xx, none should return 429
   */
  describe("Scenario A – Under limit", () => {
    const testIp = "1.2.3.4";

    it("should allow 10 requests under the per-minute limit", async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;

      const results = await callLeadCaptureNTimes(
        {
          workspaceId: testWorkspaceId,
          password: testWorkspacePassword,
          overrideIp: uniqueIp,
        },
        10,
        50 // 50ms between requests
      );

      const statusCounts = countByStatus(results);

      // Assert: No 429 responses
      expect(statusCounts[429] || 0).toBe(0);

      // Assert: All responses are 2xx (or 400/401 for validation issues, but not 429)
      const rateLimitedCount = results.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBe(0);

      console.log("Scenario A results:", statusCounts);
    });
  });

  /**
   * Scenario B – Per-minute limit
   * Send 61 requests within one minute
   * First 60 should pass, at least one should return 429
   */
  describe("Scenario B – Per-minute limit", () => {
    const testIp = "1.2.3.5";

    it("should enforce per-minute limit of 60 requests", async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;
      const requestCount = limits.perMinute + 1; // 61 requests

      const results = await callLeadCaptureNTimes(
        {
          workspaceId: testWorkspaceId,
          password: testWorkspacePassword,
          overrideIp: uniqueIp,
        },
        requestCount,
        10 // Rapid fire - 10ms between
      );

      const statusCounts = countByStatus(results);

      // Assert: At least one 429 response
      expect(statusCounts[429] || 0).toBeGreaterThan(0);

      // Assert: First 60 should not be 429
      const first60 = results.slice(0, limits.perMinute);
      const first60RateLimited = first60.filter((r) => r.status === 429).length;
      expect(first60RateLimited).toBe(0);

      // Assert: Error body includes rate limit indication
      const rateLimitedResponse = results.find((r) => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();

      const errorData = rateLimitedResponse?.data as Record<string, unknown>;
      expect(
        errorData.error === "Rate limit exceeded" ||
          JSON.stringify(errorData).toLowerCase().includes("rate") ||
          JSON.stringify(errorData).toLowerCase().includes("too many")
      ).toBe(true);

      console.log("Scenario B results:", statusCounts);
    });
  });

  /**
   * Scenario C – Different IP bypass
   * After exhausting limit for IP 1.2.3.4, new IP 5.6.7.8 should work
   */
  describe("Scenario C – Different IP bypass", () => {
    const throttledIp = "1.2.3.6";
    const freshIp = "5.6.7.8";

    it("should allow requests from different IP after one IP is throttled", async () => {
      const uniqueThrottledIp = `${throttledIp}-${generateTestId()}`;
      const uniqueFreshIp = `${freshIp}-${generateTestId()}`;

      // First exhaust limit for throttledIp
      await callLeadCaptureNTimes(
        {
          workspaceId: testWorkspaceId,
          password: testWorkspacePassword,
          overrideIp: uniqueThrottledIp,
        },
        limits.perMinute + 5,
        10
      );

      // Now send 5 requests from freshIp
      const freshIpResults = await callLeadCaptureNTimes(
        {
          workspaceId: testWorkspaceId,
          password: testWorkspacePassword,
          overrideIp: uniqueFreshIp,
        },
        5,
        50
      );

      const statusCounts = countByStatus(freshIpResults);

      // Assert: All 5 from fresh IP should NOT be 429
      expect(statusCounts[429] || 0).toBe(0);

      console.log("Scenario C results (fresh IP):", statusCounts);
    });
  });

  /**
   * Scenario D – Different workspace bypass
   * After exhausting limit for workspace1, new workspace2 from same IP should work
   */
  describe("Scenario D – Different workspace bypass", () => {
    const testIp = "1.2.3.7";

    it("should allow requests to different workspace from same IP", async () => {
      const uniqueIp = `${testIp}-${generateTestId()}`;
      const workspaceId1 = `workspace-1-${generateTestId()}`;
      const workspaceId2 = `workspace-2-${generateTestId()}`;

      // First exhaust limit for workspace1
      await callLeadCaptureNTimes(
        {
          workspaceId: workspaceId1,
          password: testWorkspacePassword,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 5,
        10
      );

      // Now send 5 requests for workspace2 from same IP
      const workspace2Results = await callLeadCaptureNTimes(
        {
          workspaceId: workspaceId2,
          password: testWorkspacePassword,
          overrideIp: uniqueIp,
        },
        5,
        50
      );

      const statusCounts = countByStatus(workspace2Results);

      // Assert: All 5 for workspace2 should NOT be 429
      expect(statusCounts[429] || 0).toBe(0);

      console.log("Scenario D results (workspace2):", statusCounts);
    });
  });

  /**
   * Scenario E – Window reset
   * After throttling, wait >65 seconds, then requests should work again
   */
  describe("Scenario E – Window reset", () => {
    const testIp = "1.2.3.8";

    it("should allow requests after minute window resets", { timeout: 120000 }, async () => {
        const uniqueIp = `${testIp}-${generateTestId()}`;

        // First exhaust limit
        const initialResults = await callLeadCaptureNTimes(
          {
            workspaceId: testWorkspaceId,
            password: testWorkspacePassword,
            overrideIp: uniqueIp,
          },
          limits.perMinute + 5,
          10
        );

        // Verify we hit the limit
        const initialStatusCounts = countByStatus(initialResults);
        expect(initialStatusCounts[429] || 0).toBeGreaterThan(0);

        console.log("Scenario E - Before wait:", initialStatusCounts);

        // Wait for window to reset (65 seconds)
        console.log("Waiting 65 seconds for window reset...");
        await sleep(65000);

        // Now send 5 more requests
        const afterResetResults = await callLeadCaptureNTimes(
          {
            workspaceId: testWorkspaceId,
            password: testWorkspacePassword,
            overrideIp: uniqueIp,
          },
          5,
          50
        );

        const afterResetStatusCounts = countByStatus(afterResetResults);

        // Assert: All 5 should NOT be 429 (window reset)
        expect(afterResetStatusCounts[429] || 0).toBe(0);

        console.log("Scenario E - After wait:", afterResetStatusCounts);
      }
    );
  });

  /**
   * Additional: Verify 429 response format
   */
  describe("429 Response Format", () => {
    it("should include proper error structure and Retry-After header", async () => {
      const uniqueIp = `format-test-${generateTestId()}`;

      // Exhaust limit
      const results = await callLeadCaptureNTimes(
        {
          workspaceId: testWorkspaceId,
          password: testWorkspacePassword,
          overrideIp: uniqueIp,
        },
        limits.perMinute + 5,
        10
      );

      const rateLimitedResponse = results.find((r) => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();

      // Check response body
      const data = rateLimitedResponse?.data as Record<string, unknown>;
      expect(data.error).toBe("Rate limit exceeded");
      expect(data.limitExceeded).toBe("minute");
      expect(typeof data.retryAfter).toBe("number");
      expect(data.retryAfter).toBe(60);

      // Check Retry-After header
      expect(rateLimitedResponse?.retryAfter).toBe(60);
    });
  });
});
