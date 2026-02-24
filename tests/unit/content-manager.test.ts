import { describe, it, expect, beforeEach } from "vitest";
import {
  loadEntries,
  searchEntries,
  searchChunks,
  getEntriesByCategory,
  getAllTags,
  getEntryById,
  getEntryCount,
  normalizeSearchTerms,
  SAMPLE_ENTRIES,
} from "../../src/lib/content-manager";
import type { ContentEntry } from "../../src/lib/content";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FIXTURES: ContentEntry[] = [
  {
    id: "api-auth",
    title: "API Authentication Guide",
    source: { type: "html", location: "https://docs.example.com/auth", ingested_at: "2025-01-01" },
    content:
      "Authentication is handled via API keys. Each request must include an Authorization header. OAuth 2.0 is also supported for third-party integrations.",
    chunks: [
      { id: "c1", text: "Authentication is handled via API keys.", metadata: { section: "Overview", chunkIndex: 0 } },
      { id: "c2", text: "OAuth 2.0 is also supported.", metadata: { section: "OAuth", chunkIndex: 1 } },
    ],
    metadata: {
      category: "guidelines",
      tags: ["api", "authentication", "security"],
      confidence: "high",
      last_updated: "2025-01-01",
    },
  },
  {
    id: "getting-started",
    title: "Getting Started with the Platform",
    source: { type: "html", location: "https://docs.example.com/start", ingested_at: "2025-01-01" },
    content:
      "Welcome to the platform. This guide walks you through setting up your first project, configuring your environment, and deploying your first application.",
    chunks: [
      { id: "c3", text: "This guide walks you through setting up your first project.", metadata: { section: "Setup", chunkIndex: 0 } },
      { id: "c4", text: "Deploying your first application.", metadata: { section: "Deploy", chunkIndex: 1 } },
    ],
    metadata: {
      category: "general",
      tags: ["getting-started", "setup", "deployment"],
      confidence: "high",
      last_updated: "2025-01-01",
    },
  },
  {
    id: "component-button",
    title: "Button Component",
    source: { type: "html", location: "https://docs.example.com/button", ingested_at: "2025-01-01" },
    content:
      "The Button component supports primary, secondary, and ghost variants. It accepts onClick handlers and can be disabled.",
    chunks: [
      { id: "c5", text: "The Button component supports primary, secondary, and ghost variants.", metadata: { section: "Variants", chunkIndex: 0 } },
    ],
    metadata: {
      category: "components",
      tags: ["button", "ui", "component"],
      confidence: "medium",
      last_updated: "2025-01-01",
    },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("content-manager", () => {
  beforeEach(() => {
    loadEntries(FIXTURES);
  });

  describe("loadEntries", () => {
    it("loads valid entries and counts them", () => {
      expect(getEntryCount()).toBe(3);
    });

    it("skips entries missing required fields", () => {
      const bad = [
        { id: "ok", title: "OK", content: "x", chunks: [], metadata: { category: "general", tags: ["a"], confidence: "high", last_updated: "" } },
        { id: "", title: "", content: "", chunks: [], metadata: { category: "general", tags: [], confidence: "high", last_updated: "" } },
        null as any,
      ];
      loadEntries(bad);
      // Only the first entry should load (second has empty id/title, third is null)
      expect(getEntryCount()).toBe(1);
    });

    it("builds tags index", () => {
      const tags = getAllTags();
      expect(tags).toContain("api");
      expect(tags).toContain("setup");
      expect(tags).toContain("button");
    });
  });

  describe("normalizeSearchTerms", () => {
    it("extracts meaningful words and removes stop words", () => {
      const terms = normalizeSearchTerms("what is authentication");
      expect(terms).toContain("authentication");
      expect(terms).not.toContain("what");
      expect(terms).not.toContain("is");
    });

    it("handles chapter references", () => {
      const terms = normalizeSearchTerms("chapter three overview");
      expect(terms).toContain("chapter 3");
      expect(terms).toContain("3");
    });

    it("adds plural/singular variants", () => {
      const terms = normalizeSearchTerms("buttons");
      expect(terms).toContain("buttons");
      expect(terms).toContain("button");
    });

    it("handles -ies → -y stemming", () => {
      const terms = normalizeSearchTerms("properties");
      expect(terms).toContain("properties");
      expect(terms).toContain("property");
    });
  });

  describe("searchEntries", () => {
    it("returns all entries when no query is provided", () => {
      const results = searchEntries({});
      expect(results.length).toBe(3);
    });

    it("filters by category", () => {
      const results = searchEntries({ category: "components" });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("component-button");
    });

    it("filters by tags", () => {
      const results = searchEntries({ tags: ["security"] });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("api-auth");
    });

    it("searches by query string", () => {
      const results = searchEntries({ query: "authentication" });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe("api-auth");
    });

    it("prioritises title matches over content matches", () => {
      const results = searchEntries({ query: "button" });
      expect(results[0].id).toBe("component-button");
    });

    it("respects limit", () => {
      const results = searchEntries({ query: "the", limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("searchChunks", () => {
    it("returns matching chunks", () => {
      const results = searchChunks("OAuth");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.text).toContain("OAuth");
    });

    it("returns empty array for non-matching query", () => {
      const results = searchChunks("zzzznonexistent");
      expect(results.length).toBe(0);
    });
  });

  describe("getEntriesByCategory", () => {
    it("returns entries in a category", () => {
      const results = getEntriesByCategory("guidelines");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("api-auth");
    });

    it("returns empty for unknown category", () => {
      const results = getEntriesByCategory("nonexistent" as any);
      expect(results.length).toBe(0);
    });
  });

  describe("getEntryById", () => {
    it("finds entry by id", () => {
      const entry = getEntryById("api-auth");
      expect(entry).toBeDefined();
      expect(entry!.title).toBe("API Authentication Guide");
    });

    it("returns undefined for unknown id", () => {
      expect(getEntryById("nope")).toBeUndefined();
    });
  });

  describe("SAMPLE_ENTRIES", () => {
    it("provides valid fallback content", () => {
      expect(SAMPLE_ENTRIES.length).toBeGreaterThan(0);
      expect(SAMPLE_ENTRIES[0].id).toBe("placeholder-welcome");
      expect(SAMPLE_ENTRIES[0].chunks.length).toBeGreaterThan(0);
    });
  });
});
