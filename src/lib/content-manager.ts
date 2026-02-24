/**
 * Content management system for Documentation MCP
 * Handles loading, searching, and managing content entries.
 *
 * Domain-agnostic: scoring works for any documentation topic.
 */

import { ContentEntry, Category, SearchOptions, ContentChunk } from "./content";

// In-memory storage for entries
let entries: ContentEntry[] = [];
let tags: Set<string> = new Set();

// Placeholder entries for when no content has been ingested
// Users should replace this by ingesting their own documentation
export const SAMPLE_ENTRIES: ContentEntry[] = [
  {
    id: "placeholder-welcome",
    title: "Welcome to Your Documentation Assistant",
    source: {
      type: "html",
      location: "placeholder-welcome.json",
      ingested_at: new Date().toISOString(),
    },
    content: `This is a placeholder message that appears when no documentation has been ingested yet.

To add your own documentation to this MCP server, please follow these steps:

1. Prepare your documentation in one of these formats:
   - Markdown files in a directory
   - Website/documentation site URL
   - CSV file with URLs to crawl
   - Individual PDF files

2. Run the appropriate ingestion command:
   - For Markdown: npm run ingest:markdown -- --dir=./path/to/docs
   - For websites: npm run ingest:web -- --url=https://your-docs.com
   - For CSV files: npm run ingest:csv -- urls.csv
   - For PDFs: npm run ingest:pdf ./document.pdf

3. Upload to Supabase with vector embeddings:
   - npm run ingest:supabase

Once your documentation is ingested, this placeholder will be replaced with actual search results from your content.

For more details, see the README.md file in the project root.`,
    chunks: [
      {
        id: "chunk-1",
        text: "This is a placeholder message that appears when no documentation has been ingested yet. To add your own documentation, you need to ingest content and upload it to Supabase.",
        metadata: {
          section: "Introduction",
          chunkIndex: 0,
        },
      },
      {
        id: "chunk-2",
        text: "Run ingestion commands to add your documentation: npm run ingest:markdown for local files, npm run ingest:web for websites, or npm run ingest:csv for URL lists. Then upload to Supabase with npm run ingest:supabase.",
        metadata: {
          section: "Getting Started",
          chunkIndex: 1,
        },
      },
    ],
    metadata: {
      category: "general",
      tags: ["getting-started", "setup", "documentation"],
      confidence: "high",
      system: "Placeholder Content",
      last_updated: new Date().toISOString(),
    },
  },
];

/**
 * Load entries into memory
 */
export function loadEntries(entriesToLoad: ContentEntry[]): void {
  const validEntries: ContentEntry[] = [];

  for (const entry of entriesToLoad) {
    if (!entry || typeof entry !== "object") {
      console.warn("Skipping invalid entry (not an object):", entry);
      continue;
    }
    if (!entry.id || !entry.title) {
      console.warn("Skipping entry with missing id or title:", entry);
      continue;
    }
    if (!entry.metadata || !entry.metadata.tags || !Array.isArray(entry.metadata.tags)) {
      console.warn(`Skipping entry "${entry.title}" with invalid metadata:`, entry.metadata);
      continue;
    }
    validEntries.push(entry);
  }

  entries = validEntries;

  // Build tags index
  tags.clear();
  for (const entry of entries) {
    for (const tag of entry.metadata.tags) {
      tags.add(tag);
    }
  }

  console.log(
    `Loaded ${entries.length} valid entries (${entriesToLoad.length - entries.length} skipped) with ${tags.size} unique tags`
  );
}

/**
 * Load entries from disk (Node.js only — not available in Workers)
 */
export async function loadEntriesFromDisk(): Promise<void> {
  console.log("loadEntriesFromDisk() is not available in Cloudflare Worker environment");
  loadEntries(SAMPLE_ENTRIES);
}

// ---------------------------------------------------------------------------
// Search normalisation helpers (domain-agnostic)
// ---------------------------------------------------------------------------

/** Stop-words that add no search value */
const STOP_WORDS = new Set([
  "what", "how", "when", "where", "why", "which", "who",
  "does", "do", "did", "will", "would", "should", "could", "can",
  "is", "are", "was", "were", "the", "a", "an", "of", "for",
  "in", "on", "at", "to", "from", "with", "by", "about",
  "you", "read", "me", "that", "this", "these", "those",
  "and", "but", "not", "yet", "nor", "so",
]);

/**
 * Normalise a search query into meaningful terms.
 *
 * Handles chapter references and basic plural/singular stemming.
 * No domain-specific term lists — works with any documentation topic.
 */
export function normalizeSearchTerms(query: string): string[] {
  let normalizedQuery = query.toLowerCase();

  const terms: string[] = [];

  // Handle chapter number variants
  normalizedQuery = normalizedQuery
    .replace(/\bchapter\s+two\b/g, "chapter 2")
    .replace(/\bchapter\s+three\b/g, "chapter 3")
    .replace(/\bchapter\s+four\b/g, "chapter 4")
    .replace(/\bchapter\s+five\b/g, "chapter 5")
    .replace(/\bchapter\s+one\b/g, "chapter 1");

  // Extract chapter references
  const chapterMatch = normalizedQuery.match(/chapter\s+\d+/);
  if (chapterMatch) {
    terms.push(chapterMatch[0]);
    const num = chapterMatch[0].match(/\d+/);
    if (num) terms.push(num[0]);
  }

  // Clean away stop-words and punctuation
  const cleaned = normalizedQuery
    .replace(/[?!.,;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Add all meaningful words
  for (const word of words) {
    if (!terms.includes(word)) terms.push(word);
  }

  // Add basic singular/plural variants (lightweight stemming)
  for (const word of [...terms]) {
    if (word.endsWith("ies")) {
      const singular = word.slice(0, -3) + "y";
      if (!terms.includes(singular)) terms.push(singular);
    } else if (word.endsWith("es")) {
      const singular = word.slice(0, -2);
      if (singular.length > 2 && !terms.includes(singular)) terms.push(singular);
    } else if (word.endsWith("s") && !word.endsWith("ss")) {
      const singular = word.slice(0, -1);
      if (singular.length > 2 && !terms.includes(singular)) terms.push(singular);
    } else if (!word.endsWith("s")) {
      const plural = word + "s";
      if (!terms.includes(plural)) terms.push(plural);
    }
  }

  return terms.filter((t) => t.length > 0);
}

// ---------------------------------------------------------------------------
// Entry-level search
// ---------------------------------------------------------------------------

export function searchEntries(options: SearchOptions = {}): ContentEntry[] {
  const { query, category, tags: filterTags, confidence, limit = 50 } = options;

  let results = [...entries];

  if (category) {
    results = results.filter((e) => e.metadata.category === category);
  }
  if (filterTags && filterTags.length > 0) {
    results = results.filter((e) => filterTags.some((t) => e.metadata.tags.includes(t)));
  }
  if (confidence) {
    results = results.filter((e) => e.metadata.confidence === confidence);
  }

  if (query) {
    const queryLower = query.toLowerCase();
    const searchTerms = normalizeSearchTerms(query);

    const scored = results.map((entry) => ({
      entry,
      score: calculateRelevanceScore(entry, queryLower, searchTerms),
    }));

    const relevant = scored.filter((s) => s.score >= 0.2);

    if (relevant.length > 0) {
      relevant.sort((a, b) => b.score - a.score);
      results = relevant.map((s) => s.entry);
    } else {
      // Fallback: broad text matching
      results = results.filter((entry) => {
        const title = entry.title.toLowerCase();
        const content = entry.content.toLowerCase();
        return searchTerms.some(
          (term) =>
            title.includes(term) ||
            content.includes(term) ||
            entry.metadata.tags.some((tag) => tag.toLowerCase().includes(term))
        );
      });
    }
  }

  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Chunk-level search
// ---------------------------------------------------------------------------

export function searchChunks(
  query: string,
  limit: number = 5
): Array<{ entry: ContentEntry; chunk: ContentChunk; score: number }> {
  const queryLower = query.toLowerCase();
  const searchTerms = normalizeSearchTerms(query);

  const results: Array<{ entry: ContentEntry; chunk: ContentChunk; score: number }> = [];

  for (const entry of entries) {
    for (const chunk of entry.chunks) {
      const chunkLower = chunk.text.toLowerCase();
      const titleLower = entry.title.toLowerCase();

      const exactMatch = chunkLower.includes(queryLower);
      const termMatch = searchTerms.some((t) => chunkLower.includes(t));
      const titleMatch = searchTerms.some((t) => titleLower.includes(t));

      if (exactMatch || termMatch || titleMatch) {
        const score = calculateChunkRelevanceScore(chunk, queryLower, searchTerms, entry);
        results.push({ entry, chunk, score });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Public getters
// ---------------------------------------------------------------------------

export function getEntriesByCategory(category: Category): ContentEntry[] {
  return entries.filter((e) => e.metadata.category === category);
}

export function getAllTags(): string[] {
  return Array.from(tags).sort();
}

export function getEntryById(id: string): ContentEntry | undefined {
  return entries.find((e) => e.id === id);
}

export function getEntryCount(): number {
  return entries.length;
}

export function getEntriesSummary(): Array<{
  id: string;
  title: string;
  category: string;
  tags: string[];
}> {
  return entries.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.metadata.category,
    tags: e.metadata.tags,
  }));
}

// ---------------------------------------------------------------------------
// Scoring (domain-agnostic)
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystack: string, needle: string): number {
  try {
    return (haystack.match(new RegExp(escapeRegex(needle), "g")) || []).length;
  } catch {
    return 0;
  }
}

/**
 * Calculate relevance score for an entry (domain-agnostic).
 *
 * Scoring priorities:
 *   1. Exact title match (+100)
 *   2. "What is / define" queries that match introductory content (+90/+80)
 *   3. Glossary entries that match search terms (+50)
 *   4. Individual term matches in title (+15 each)
 *   5. Full query match in title (+20 each occurrence)
 *   6. Singular/plural bridging in title (+15)
 *   7. Content matches (+1 each)
 *   8. Tag matches (+5 each)
 *   9. Confidence boost (+1 high, +0.5 medium)
 */
function calculateRelevanceScore(
  entry: ContentEntry,
  query: string,
  searchTerms: string[] = []
): number {
  let score = 0;
  const titleLower = entry.title.toLowerCase();
  const contentLower = entry.content.toLowerCase();

  // 1. Exact title match
  if (titleLower.includes(query)) {
    score += 100;
  }

  // 2. "What is / define" queries — boost introductory content
  const isDefinitionQuery =
    query.includes("what is") ||
    query.includes("what are") ||
    query.includes("define") ||
    query.includes("definition");

  if (isDefinitionQuery) {
    if (
      /\b(101|glossary|introduction|basics|guide|overview|getting started)\b/i.test(entry.title)
    ) {
      score += 90;
    }
    if (
      contentLower.includes("definition:") ||
      contentLower.includes("is a ") ||
      contentLower.includes("summary:") ||
      contentLower.includes("what is") ||
      contentLower.includes("what are")
    ) {
      score += 80;
    }
  }

  // 3. Glossary boost
  if (
    entry.metadata.category === "glossary" ||
    titleLower.includes("glossary")
  ) {
    for (const term of searchTerms) {
      if (contentLower.includes(term)) {
        score += 50;
        break;
      }
    }
  }

  // 4. Individual term matches in title (uniform weight)
  for (const term of searchTerms) {
    const titleHits = countOccurrences(titleLower, term);
    if (titleHits > 0) {
      // Chapter references get extra weight
      if (term.includes("chapter") || /^\d+$/.test(term)) {
        score += titleHits * 50;
      } else {
        score += titleHits * 15;
      }
    }

    // Content matches (lower weight)
    score += countOccurrences(contentLower, term);

    // Tag matches
    const tagHits = entry.metadata.tags.filter((t) => t.toLowerCase().includes(term)).length;
    score += tagHits * 5;
  }

  // 5. Full query exact match in title/content
  score += countOccurrences(titleLower, query) * 20;
  score += countOccurrences(contentLower, query) * 2;

  // 6. Tag exact match on full query
  const tagExact = entry.metadata.tags.filter((t) => t.toLowerCase().includes(query)).length;
  score += tagExact * 10;

  // 7. Confidence boost
  if (entry.metadata.confidence === "high") score += 1;
  if (entry.metadata.confidence === "medium") score += 0.5;

  return score;
}

/**
 * Detect navigation/boilerplate content that should be deprioritised.
 */
function isNavigationContent(text: string): boolean {
  const lower = text.toLowerCase();
  const linkCount = (lower.match(/\[https?:\/\/[^\]]+\]/g) || []).length;
  if (linkCount > 5 && (linkCount * 50) / lower.length > 0.3) return true;

  const navPatterns = [
    /help.*enterto select.*navigate.*close/,
    /get started.*billing.*teams.*organizations/,
    /english.*deutsch.*español.*français.*nederlands/,
  ];
  return navPatterns.some((p) => p.test(lower));
}

/**
 * Calculate relevance score for a chunk (domain-agnostic).
 */
function calculateChunkRelevanceScore(
  chunk: ContentChunk,
  query: string,
  searchTerms: string[] = [],
  entry?: ContentEntry
): number {
  let score = 0;
  const chunkLower = chunk.text.toLowerCase();

  // Penalise navigation content
  if (isNavigationContent(chunk.text)) {
    score -= 50;
  }

  // Boost definition/summary content
  if (
    chunkLower.includes("definition:") ||
    chunkLower.includes("summary:") ||
    /\bis a\b/.test(chunkLower)
  ) {
    score += 30;
  }

  // Title match signals (from parent entry)
  if (entry) {
    const titleLower = entry.title.toLowerCase();
    if (titleLower.includes(query)) score += 100;

    for (const term of searchTerms) {
      if (titleLower.includes(term)) {
        if (term.includes("chapter") || /^\d+$/.test(term)) {
          score += 50;
        } else {
          score += 15;
        }
      }
    }
  }

  // Exact query match in chunk text
  score += countOccurrences(chunkLower, query) * 5;

  // Individual term matches in chunk text
  for (const term of searchTerms) {
    score += countOccurrences(chunkLower, term);

    // Section heading bonus
    if (chunk.metadata?.section?.toLowerCase().includes(term)) {
      score += 2;
    }
  }

  // Section heading match on full query
  if (chunk.metadata?.section?.toLowerCase().includes(query)) {
    score += 5;
  }

  return score;
}
