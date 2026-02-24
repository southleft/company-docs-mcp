import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

// Test the pure-function helpers from ingest-supabase.ts by reimplementing
// them here (the script uses top-level side effects that prevent direct import).

function contentHash(title: string, content: string): string {
  return createHash("sha256")
    .update(`${title}\n${content}`)
    .digest("hex");
}

function chunkText(text: string, chunkSize = 1000): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += ` ${sentence}`;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

describe("ingest-supabase helpers", () => {
  describe("contentHash", () => {
    it("produces a 64-character hex string", () => {
      const hash = contentHash("Test", "Some content");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it("returns the same hash for identical input", () => {
      const a = contentHash("Title", "Body");
      const b = contentHash("Title", "Body");
      expect(a).toBe(b);
    });

    it("returns different hashes for different content", () => {
      const a = contentHash("Title", "Body A");
      const b = contentHash("Title", "Body B");
      expect(a).not.toBe(b);
    });
  });

  describe("chunkText", () => {
    it("returns the original text when under chunk size", () => {
      const result = chunkText("Short text.", 1000);
      expect(result).toEqual(["Short text."]);
    });

    it("splits long text at sentence boundaries", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const result = chunkText(text, 30);
      expect(result.length).toBeGreaterThan(1);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(35); // some slack for trimming
      }
    });

    it("handles text without sentence endings", () => {
      const result = chunkText("No sentence ending here");
      expect(result).toEqual(["No sentence ending here"]);
    });

    it("returns non-empty array for empty string", () => {
      const result = chunkText("");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
