/**
 * Website crawler for recursive ingestion of all pages within a domain
 */

import { ContentEntry, ContentMetadata } from "../../types/content";
import { fetchURL, URLFetchOptions } from "./url-fetcher";
import { generateId } from "../../src/lib/id-generator";
import * as fs from 'fs';
import * as path from 'path';

export interface CrawlOptions extends URLFetchOptions {
  maxDepth?: number;           // Maximum crawl depth (default: 3)
  maxPages?: number;           // Maximum number of pages to crawl (default: 100)
  followExternal?: boolean;    // Follow external links (default: false)
  includePatterns?: string[];  // URL patterns to include (regex)
  excludePatterns?: string[];  // URL patterns to exclude (regex)
  delayMs?: number;           // Delay between requests in milliseconds (default: 1000)
  outputDir?: string;         // Output directory for entries
  respectRobotsTxt?: boolean; // Check robots.txt (default: true)
  saveProgress?: boolean;     // Save crawl progress for resuming (default: true)
}

interface CrawlState {
  visited: Set<string>;
  queued: Map<string, number>; // URL -> depth
  failed: Map<string, string>; // URL -> error message
  entries: ContentEntry[];
  startUrl: string;
  domain: string;
}

interface CrawlProgress {
  visited: string[];
  queued: Array<[string, number]>;
  failed: Array<[string, string]>;
  startUrl: string;
  timestamp: string;
}

/**
 * Crawls a website starting from the given URL
 */
export async function crawlWebsite(
  startUrl: string,
  options: CrawlOptions = {}
): Promise<ContentEntry[]> {
  const {
    maxDepth = 3,
    maxPages = 100,
    followExternal = false,
    includePatterns = [],
    excludePatterns = [],
    delayMs = 1000,
    outputDir = 'content/entries',
    respectRobotsTxt = true,
    saveProgress = true,
    ...fetchOptions
  } = options;

  console.log(`🕷️ Starting website crawl from: ${startUrl}`);
  console.log(`📊 Settings: maxDepth=${maxDepth}, maxPages=${maxPages}, delay=${delayMs}ms`);

  // Parse the start URL to get the domain
  const startUrlObj = new URL(startUrl);
  const domain = startUrlObj.hostname;

  // Initialize crawl state
  const state: CrawlState = {
    visited: new Set(),
    queued: new Map([[normalizeUrl(startUrl), 0]]),
    failed: new Map(),
    entries: [],
    startUrl: normalizeUrl(startUrl),
    domain
  };

  // Try to load previous progress
  if (saveProgress) {
    loadProgress(state, outputDir);
  }

  // Check robots.txt if requested
  let disallowedPaths: string[] = [];
  if (respectRobotsTxt) {
    disallowedPaths = await fetchRobotsTxt(startUrlObj.origin);
    console.log(`🤖 Loaded ${disallowedPaths.length} disallowed paths from robots.txt`);
  }

  // Compile regex patterns
  const includeRegexes = includePatterns.map(p => new RegExp(p));
  const excludeRegexes = excludePatterns.map(p => new RegExp(p));

  // Main crawl loop
  while (state.queued.size > 0 && state.visited.size < maxPages) {
    // Get next URL from queue (breadth-first)
    const [url, depth] = state.queued.entries().next().value;
    state.queued.delete(url);

    // Skip if already visited
    if (state.visited.has(url)) {
      continue;
    }

    // Check if URL should be crawled
    if (!shouldCrawlUrl(url, {
      domain,
      followExternal,
      includeRegexes,
      excludeRegexes,
      disallowedPaths,
      maxDepth,
      currentDepth: depth
    })) {
      console.log(`⏭️ Skipping: ${url}`);
      continue;
    }

    console.log(`\n📄 Crawling (depth ${depth}/${maxDepth}): ${url}`);
    console.log(`   Progress: ${state.visited.size + 1}/${maxPages} pages`);

    try {
      // Fetch and parse the page
      const entry = await fetchURL(url, fetchOptions);
      state.entries.push(entry);
      state.visited.add(url);

      // Save entry immediately
      if (outputDir) {
        await saveEntry(entry, outputDir);
        console.log(`   ✅ Saved: ${entry.title}`);
      }

      // Extract links from the content
      if (depth < maxDepth) {
        const links = extractLinks(entry.content, url);
        console.log(`   🔗 Found ${links.length} links`);
        
        // Debug: Show first few links
        if (links.length > 0) {
          console.log(`   📍 Sample links:`);
          links.slice(0, 5).forEach(link => console.log(`      - ${link}`));
        }

        // Add new links to queue
        let newLinksAdded = 0;
        for (const link of links) {
          const normalizedLink = normalizeUrl(link);
          if (!state.visited.has(normalizedLink) && !state.queued.has(normalizedLink)) {
            state.queued.set(normalizedLink, depth + 1);
            newLinksAdded++;
          }
        }
        if (newLinksAdded > 0) {
          console.log(`   ➕ Added ${newLinksAdded} new links to queue`);
        }
      }

      // Save progress periodically
      if (saveProgress && state.visited.size % 10 === 0) {
        saveProgressToFile(state, outputDir);
      }

      // Delay between requests to be respectful
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ Failed: ${errorMsg}`);
      state.failed.set(url, errorMsg);
    }
  }

  // Save final progress
  if (saveProgress) {
    saveProgressToFile(state, outputDir);
  }

  // Report results
  console.log(`\n🎉 Crawl complete!`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Successfully crawled: ${state.visited.size} pages`);
  console.log(`   📝 Generated entries: ${state.entries.length}`);
  console.log(`   ❌ Failed: ${state.failed.size} pages`);
  console.log(`   ⏭️ Skipped/queued: ${state.queued.size} pages`);

  if (state.failed.size > 0) {
    console.log(`\n❌ Failed URLs:`);
    for (const [url, error] of state.failed.entries()) {
      console.log(`   - ${url}: ${error}`);
    }
  }

  return state.entries;
}

/**
 * Extracts links from HTML content
 */
function extractLinks(content: string, baseUrl: string): string[] {
  const links: string[] = [];
  
  // Extract URLs from markdown-style links [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    try {
      const absoluteUrl = new URL(match[2], baseUrl).href;
      links.push(absoluteUrl);
    } catch {
      // Invalid URL, skip
    }
  }

  // Extract URLs that appear standalone
  const urlRegex = /https?:\/\/[^\s<>"\[\]]+/g;
  while ((match = urlRegex.exec(content)) !== null) {
    try {
      const absoluteUrl = new URL(match[0], baseUrl).href;
      links.push(absoluteUrl);
    } catch {
      // Invalid URL, skip
    }
  }

  // Also try to extract from any remaining HTML if present
  const hrefRegex = /href=["']([^"']+)["']/gi;
  while ((match = hrefRegex.exec(content)) !== null) {
    try {
      const absoluteUrl = new URL(match[1], baseUrl).href;
      links.push(absoluteUrl);
    } catch {
      // Invalid URL, skip
    }
  }

  // Remove duplicates and return
  return [...new Set(links)];
}

/**
 * Determines if a URL should be crawled
 */
function shouldCrawlUrl(
  url: string,
  options: {
    domain: string;
    followExternal: boolean;
    includeRegexes: RegExp[];
    excludeRegexes: RegExp[];
    disallowedPaths: string[];
    maxDepth: number;
    currentDepth: number;
  }
): boolean {
  try {
    const urlObj = new URL(url);

    // Check depth
    if (options.currentDepth >= options.maxDepth) {
      return false;
    }

    // Check domain
    if (!options.followExternal && urlObj.hostname !== options.domain) {
      return false;
    }

    // Check include patterns
    if (options.includeRegexes.length > 0) {
      if (!options.includeRegexes.some(regex => regex.test(url))) {
        return false;
      }
    }

    // Check exclude patterns
    if (options.excludeRegexes.some(regex => regex.test(url))) {
      return false;
    }

    // Check robots.txt disallowed paths
    if (options.disallowedPaths.some(path => urlObj.pathname.startsWith(path))) {
      return false;
    }

    // Skip non-HTML resources
    const skipExtensions = ['.pdf', '.zip', '.tar', '.gz', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.css', '.js', '.json', '.xml'];
    if (skipExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes a URL for consistent comparison
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove hash
    urlObj.hash = '';
    // Remove trailing slash
    if (urlObj.pathname.endsWith('/') && urlObj.pathname !== '/') {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    // Sort query parameters
    urlObj.searchParams.sort();
    return urlObj.href;
  } catch {
    return url;
  }
}

/**
 * Fetches and parses robots.txt
 */
async function fetchRobotsTxt(origin: string): Promise<string[]> {
  const disallowedPaths: string[] = [];
  
  try {
    const robotsUrl = `${origin}/robots.txt`;
    const response = await fetch(robotsUrl);
    
    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n');
      
      let isRelevantUserAgent = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for User-agent
        if (trimmed.toLowerCase().startsWith('user-agent:')) {
          const agent = trimmed.substring(11).trim().toLowerCase();
          isRelevantUserAgent = agent === '*' || agent === 'designsystemsmcp';
        }
        
        // Parse Disallow rules
        if (isRelevantUserAgent && trimmed.toLowerCase().startsWith('disallow:')) {
          const path = trimmed.substring(9).trim();
          if (path) {
            disallowedPaths.push(path);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not fetch robots.txt: ${error instanceof Error ? error.message : error}`);
  }
  
  return disallowedPaths;
}

/**
 * Saves a content entry to disk
 */
async function saveEntry(entry: ContentEntry, outputDir: string): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename
  const filename = `${entry.id}-${entry.source.type}-${sanitizeFilename(entry.title)}.json`;
  const filepath = path.join(outputDir, filename);

  // Write file
  fs.writeFileSync(filepath, JSON.stringify(entry, null, 2));
}

/**
 * Saves crawl progress to a file
 */
function saveProgressToFile(state: CrawlState, outputDir: string): void {
  const progressFile = path.join(outputDir, '.crawl-progress.json');
  
  const progress: CrawlProgress = {
    visited: Array.from(state.visited),
    queued: Array.from(state.queued.entries()),
    failed: Array.from(state.failed.entries()),
    startUrl: state.startUrl,
    timestamp: new Date().toISOString()
  };

  try {
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    console.log(`   💾 Progress saved (${state.visited.size} pages visited)`);
  } catch (error) {
    console.warn(`   ⚠️ Could not save progress: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Loads previous crawl progress
 */
function loadProgress(state: CrawlState, outputDir: string): boolean {
  const progressFile = path.join(outputDir, '.crawl-progress.json');
  
  try {
    if (fs.existsSync(progressFile)) {
      const content = fs.readFileSync(progressFile, 'utf-8');
      const progress: CrawlProgress = JSON.parse(content);
      
      // Only load if it's for the same starting URL
      if (progress.startUrl === state.startUrl) {
        state.visited = new Set(progress.visited);
        state.queued = new Map(progress.queued);
        state.failed = new Map(progress.failed);
        
        console.log(`📂 Resumed previous crawl:`);
        console.log(`   - Already visited: ${state.visited.size} pages`);
        console.log(`   - Queued: ${state.queued.size} pages`);
        console.log(`   - Failed: ${state.failed.size} pages`);
        
        return true;
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not load progress: ${error instanceof Error ? error.message : error}`);
  }
  
  return false;
}

/**
 * Sanitize filename for file system
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .substring(0, 50);
}

/**
 * Creates a crawl report
 */
export function createCrawlReport(entries: ContentEntry[], outputPath: string): void {
  const report = {
    timestamp: new Date().toISOString(),
    totalPages: entries.length,
    byCategory: {} as Record<string, number>,
    bySite: {} as Record<string, number>,
    entries: entries.map(e => ({
      id: e.id,
      title: e.title,
      url: e.metadata.source_url || e.source.location,
      category: e.metadata.category,
      tags: e.metadata.tags
    }))
  };

  // Count by category
  for (const entry of entries) {
    const category = entry.metadata.category || 'general';
    report.byCategory[category] = (report.byCategory[category] || 0) + 1;
  }

  // Count by site
  for (const entry of entries) {
    const url = entry.metadata.source_url || entry.source.location;
    try {
      const hostname = new URL(url).hostname;
      report.bySite[hostname] = (report.bySite[hostname] || 0) + 1;
    } catch {
      // Skip invalid URLs
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`📊 Crawl report saved to: ${outputPath}`);
}
