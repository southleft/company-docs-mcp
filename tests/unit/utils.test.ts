import { describe, it, expect } from "vitest";
import {
  withTimeout,
  isResourceLimitError,
  createResourceLimitErrorMessage,
} from "../../src/lib/utils";

describe("utils", () => {
  describe("withTimeout", () => {
    it("resolves when the promise completes before timeout", async () => {
      const result = await withTimeout(
        Promise.resolve("ok"),
        1000,
        "test op"
      );
      expect(result).toBe("ok");
    });

    it("rejects when the promise exceeds the timeout", async () => {
      const slow = new Promise((resolve) => setTimeout(resolve, 5000));
      await expect(
        withTimeout(slow, 50, "slow op")
      ).rejects.toThrow("slow op timed out");
    });

    it("propagates the original promise rejection", async () => {
      await expect(
        withTimeout(Promise.reject(new Error("boom")), 1000, "op")
      ).rejects.toThrow("boom");
    });
  });

  describe("isResourceLimitError", () => {
    it("detects resource limit errors by message", () => {
      expect(isResourceLimitError(new Error("Worker exceeded CPU time limit"))).toBe(true);
      expect(isResourceLimitError(new Error("out of memory"))).toBe(true);
      expect(isResourceLimitError(new Error("timeout during request"))).toBe(true);
      expect(isResourceLimitError(new Error("cpu time limit reached"))).toBe(true);
      expect(isResourceLimitError(new Error("resource limit hit"))).toBe(true);
    });

    it("returns false for normal errors", () => {
      expect(isResourceLimitError(new Error("not found"))).toBe(false);
      expect(isResourceLimitError(new Error("invalid input"))).toBe(false);
    });

    it("handles null/undefined gracefully", () => {
      expect(isResourceLimitError(null)).toBe(false);
      expect(isResourceLimitError(undefined)).toBe(false);
      expect(isResourceLimitError({})).toBe(false);
    });
  });

  describe("createResourceLimitErrorMessage", () => {
    it("returns a string with actionable guidance", () => {
      const msg = createResourceLimitErrorMessage();
      expect(msg).toContain("Resource limit");
      expect(msg).toContain("retry");
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(50);
    });
  });
});
