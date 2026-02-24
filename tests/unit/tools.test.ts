import { describe, it, expect } from "vitest";
import { OPENAI_TOOLS, ensureContentLoaded } from "../../src/tools";

describe("tools", () => {
  describe("OPENAI_TOOLS", () => {
    it("exports a non-empty array of tool definitions", () => {
      expect(Array.isArray(OPENAI_TOOLS)).toBe(true);
      expect(OPENAI_TOOLS.length).toBeGreaterThan(0);
    });

    it("each tool has the correct OpenAI function-call structure", () => {
      for (const tool of OPENAI_TOOLS) {
        expect(tool.type).toBe("function");
        expect(tool.function).toBeDefined();
        expect(typeof tool.function.name).toBe("string");
        expect(typeof tool.function.description).toBe("string");
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe("object");
      }
    });

    it("includes search_documentation tool", () => {
      const search = OPENAI_TOOLS.find((t) => t.function.name === "search_documentation");
      expect(search).toBeDefined();
      expect(search!.function.parameters.required).toContain("query");
    });

    it("includes search_chunks tool", () => {
      const chunks = OPENAI_TOOLS.find((t) => t.function.name === "search_chunks");
      expect(chunks).toBeDefined();
      expect(chunks!.function.parameters.required).toContain("query");
    });

    it("uses domain-agnostic tool names (no design-system references)", () => {
      for (const tool of OPENAI_TOOLS) {
        const name = tool.function.name;
        expect(name).not.toContain("design");
        expect(name).not.toContain("figma");
      }
    });
  });

  describe("ensureContentLoaded", () => {
    it("is a function", () => {
      expect(typeof ensureContentLoaded).toBe("function");
    });
  });
});
