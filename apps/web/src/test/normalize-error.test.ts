/**
 * normalizeError Regression Test
 * 
 * Ensures error objects like { statusCode, message, error, subscriptionLimits }
 * are properly converted to strings and never crash React rendering.
 */

import { describe, it, expect } from "vitest";
import { normalizeError } from "@/lib/normalizeError";

describe("normalizeError", () => {
  it("returns string errors unchanged", () => {
    expect(normalizeError("Simple error")).toBe("Simple error");
    expect(normalizeError("")).toBe("");
  });

  it("extracts message from Error instances", () => {
    const error = new Error("Test error message");
    expect(normalizeError(error)).toBe("Test error message");
  });

  it("extracts message from API error objects", () => {
    // The exact shape that caused React error #31
    const apiError = {
      statusCode: 402,
      message: "Upgrade required",
      error: "PAYWALL",
      subscriptionLimits: { voiceCalls: 0, maxCalls: 100 },
    };
    
    expect(normalizeError(apiError)).toBe("Upgrade required");
  });

  it("falls back to error field if message is missing", () => {
    const apiError = {
      statusCode: 500,
      error: "Internal server error",
    };
    
    expect(normalizeError(apiError)).toBe("Internal server error");
  });

  it("handles Supabase error format", () => {
    const supabaseError = {
      message: "JWT expired",
      code: "401",
    };
    
    expect(normalizeError(supabaseError)).toBe("JWT expired");
  });

  it("handles nested error objects", () => {
    const nestedError = {
      error: {
        message: "Nested error message",
        code: "NESTED_ERROR",
      },
    };
    
    expect(normalizeError(nestedError)).toBe("Nested error message");
  });

  it("stringifies objects without message field", () => {
    const weirdError = {
      code: 500,
      details: "Something broke",
    };
    
    const result = normalizeError(weirdError);
    expect(result).toContain("code");
    expect(result).toContain("500");
  });

  it("handles null and undefined", () => {
    expect(normalizeError(null)).toBe("Unknown error");
    expect(normalizeError(undefined)).toBe("Unknown error");
  });

  it("handles numbers and booleans", () => {
    expect(normalizeError(404)).toBe("Unknown error");
    expect(normalizeError(false)).toBe("Unknown error");
  });

  it("never returns an object (React safety)", () => {
    const testCases = [
      { statusCode: 402, message: "Upgrade required", error: "PAYWALL" },
      new Error("Test"),
      "string error",
      null,
      undefined,
      { nested: { deep: { error: "deep" } } },
    ];

    for (const testCase of testCases) {
      const result = normalizeError(testCase);
      expect(typeof result).toBe("string");
    }
  });

  it("REGRESSION: exact error shape that caused React #31", () => {
    // This is the EXACT error shape from the runtime error
    const crashingError = {
      statusCode: 402,
      message: "Upgrade required",
      error: "PAYWALL",
      subscriptionLimits: {},
    };

    const result = normalizeError(crashingError);
    
    // Must be a string
    expect(typeof result).toBe("string");
    
    // Must contain readable message
    expect(result).toBe("Upgrade required");
    
    // Must NOT be [object Object]
    expect(result).not.toBe("[object Object]");
  });
});
