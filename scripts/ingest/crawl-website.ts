#!/usr/bin/env node

/**
 * CLI script for crawling and ingesting entire websites
 */

import { crawlWebsite, createCrawlReport, CrawlOptions, updateManifest } from './website-crawler';
import * as path from 'path';
import * as fs from 'fs';

interface CLIOptions extends CrawlOptions {
  help?: boolean;
  report?: boolean;
  resume?: boolean;
  clear?: boolean;
}

function showHelp() {
  console.log(`
🕷️ Website Crawler Tool

Usage: npm run ingest:web -- <url> [options]

Arguments:
  url                   Starting URL to crawl from

Options:
  --help               Show this help message
  --max-depth <n>      Maximum crawl depth (default: 3)
  --max-pages <n>      Maximum number of pages to crawl (default: 100)
  --delay <ms>         Delay between requests in milliseconds (default: 1000)
  --follow-external    Follow links to external domains
  --include <pattern>  Include URLs matching this regex pattern (can be used multiple times)
  --exclude <pattern>  Exclude URLs matching this regex pattern (can be used multiple times)
  --output-dir <dir>   Output directory for content files (default: content/entries)
  --no-robots          Ignore robots.txt
  --no-progress        Don't save progress for resuming
  --resume             Resume a previous crawl from the same URL
  --clear              Clear previous crawl progress before starting
  --report             Generate a crawl report after completion
  --timeout <ms>       Request timeout in milliseconds (default: 30000)
  --chunk-size <n>     Chunk size for content processing (default: 1000)
  --overlap-size <n>   Overlap size between chunks (default: 100)

Examples:
  # Basic crawl of a website
  npm run ingest:web -- https://material.io/design

  # Crawl with custom depth and page limit
  npm run ingest:web -- https://polaris.shopify.com --max-depth 5 --max-pages 200

  # Crawl only specific sections
  npm run ingest:web -- https://primer.style --include "/components/" --include "/foundations/"

  # Exclude certain paths
  npm run ingest:web -- https://ant.design --exclude "/changelog" --exclude "/blog"

  # Fast crawl with no delay
  npm run ingest:web -- https://chakra-ui.com --delay 0 --max-pages 50

  # Resume a previous crawl
  npm run ingest:web -- https://material.io/design --resume

  # Generate a report after crawling
  npm run ingest:web -- https://carbon.ibm.com --report

Advanced Usage:
  # Crawl multiple related domains
  npm run ingest:web -- https://docs.example.com --follow-external --include "example\\.com"

  # Deep crawl with high limits
  npm run ingest:web -- https://design-system.com --max-depth 10 --max-pages 1000 --delay 500

  # Crawl and organize by site sections
  npm run ingest:web -- https://site.com --include "/components/" --output-dir content/entries/components
  npm run ingest:web -- https://site.com --include "/tokens/" --output-dir content/entries/tokens

Progress Management:
  The crawler automatically saves progress every 10 pages and can resume if interrupted.
  Progress is saved to: <output-dir>/.crawl-progress.json

  To resume a crawl:     npm run ingest:web -- <same-url> --resume
  To start fresh:        npm run ingest:web -- <url> --clear

Notes:
  - The crawler respects robots.txt by default
  - It automatically skips non-HTML resources (images, PDFs, etc.)
  - Use --delay to be respectful to the target server
  - Large crawls may take significant time; use --max-pages to limit scope
  `);
}

function parseArgs(): { url?: string; options: CLIOptions } {
  let args = process.argv.slice(2);

  // Check if npm has stripped the flags (when args don't contain '--' prefixes except first arg)
  const hasFlags = args.some(arg => arg.startsWith('--') && arg !== '--');

  if (!hasFlags && args.length > 1) {
    // NPM has stripped the flags, we need to reconstruct them
    // Expected order: url, max-depth value, max-pages value, exclude values...
    console.log('Debug: NPM stripped flags, reconstructing from positional args:', args);

    // For now, we'll require users to use the -- separator
    console.error('\n⚠️  Please use "--" after the command to preserve argument flags:');
    console.error('    npm run crawl:website -- <url> [options]');
    console.error('\nExample:');
    console.error('    npm run crawl:website -- https://designsystems.surf --max-depth 4 --max-pages 200 --exclude "/advertisement"\n');
    process.exit(1);
  }

  // Remove the '--' separator if present (added by npm script)
  if (args[0] === '--') {
    args = args.slice(1);
  }

  const options: CLIOptions = {
    includePatterns: [],
    excludePatterns: []
  };
  let url: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--max-depth') {
      options.maxDepth = parseInt(args[++i]);
    } else if (arg === '--max-pages') {
      options.maxPages = parseInt(args[++i]);
    } else if (arg === '--delay') {
      options.delayMs = parseInt(args[++i]);
    } else if (arg === '--follow-external') {
      options.followExternal = true;
    } else if (arg === '--include') {
      options.includePatterns!.push(args[++i]);
    } else if (arg === '--exclude') {
      options.excludePatterns!.push(args[++i]);
    } else if (arg === '--output-dir') {
      options.outputDir = args[++i];
    } else if (arg === '--no-robots') {
      options.respectRobotsTxt = false;
    } else if (arg === '--no-progress') {
      options.saveProgress = false;
    } else if (arg === '--resume') {
      options.resume = true;
    } else if (arg === '--clear') {
      options.clear = true;
    } else if (arg === '--report') {
      options.report = true;
    } else if (arg === '--timeout') {
      options.timeout = parseInt(args[++i]);
    } else if (arg === '--chunk-size') {
      options.chunkSize = parseInt(args[++i]);
    } else if (arg === '--overlap-size') {
      options.overlapSize = parseInt(args[++i]);
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      // Only treat as URL if it's not a flag and we haven't found a URL yet
      if (!url && (arg.startsWith('http://') || arg.startsWith('https://'))) {
        url = arg;
      }
    }
  }

  return { url, options };
}

function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { url, options } = parseArgs();

  // Show help
  if (options.help) {
    showHelp();
    return;
  }

  // Validate arguments
  if (!url) {
    console.error('❌ Error: URL is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  if (!validateUrl(url)) {
    console.error(`❌ Error: Invalid URL: ${url}`);
    console.log('Please provide a valid URL starting with http:// or https://');
    process.exit(1);
  }

  // Clear previous progress if requested
  if (options.clear && options.outputDir) {
    const progressFile = path.join(options.outputDir, '.crawl-progress.json');
    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
      console.log('🗑️ Cleared previous crawl progress');
    }
  }

  console.log(`🚀 Starting website crawl...`);
  console.log(`🌐 Target: ${url}`);
  console.log(`📁 Output: ${options.outputDir || 'content/entries'}/`);

  // Show options
  if (options.maxDepth !== undefined || options.maxPages !== undefined ||
      options.includePatterns?.length || options.excludePatterns?.length) {
    console.log(`\n⚙️ Options:`);
    if (options.maxDepth !== undefined) console.log(`   - Max depth: ${options.maxDepth}`);
    if (options.maxPages !== undefined) console.log(`   - Max pages: ${options.maxPages}`);
    if (options.delayMs !== undefined) console.log(`   - Delay: ${options.delayMs}ms`);
    if (options.followExternal) console.log(`   - Following external links: yes`);
    if (options.includePatterns?.length) {
      console.log(`   - Include patterns: ${options.includePatterns.join(', ')}`);
    }
    if (options.excludePatterns?.length) {
      console.log(`   - Exclude patterns: ${options.excludePatterns.join(', ')}`);
    }
    if (options.respectRobotsTxt === false) console.log(`   - Respecting robots.txt: no`);
  }

  console.log(`\n${'='.repeat(60)}\n`);

  try {
    const startTime = Date.now();

    // Perform the crawl
    const entries = await crawlWebsite(url, options);

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n⏱️ Crawl duration: ${duration} seconds`);

    // Generate report if requested
    if (options.report && entries.length > 0) {
      const reportPath = path.join(
        options.outputDir || 'content/entries',
        `crawl-report-${new Date().toISOString().split('T')[0]}.json`
      );
      createCrawlReport(entries, reportPath);
    }

    // Regenerate manifest if entries were created
    if (entries.length > 0) {
      console.log(`\n🔄 Regenerating content manifest...`);
      try {
        updateManifest(options.outputDir || 'content/entries');
        console.log(`✅ Manifest updated automatically with all JSON files`);
      } catch (error) {
        console.warn(`⚠️  Failed to regenerate manifest automatically:`, error);
        console.log(`Please manually update the manifest if needed`);
      }

      console.log(`\n📝 Next steps:`);
      console.log(`1. Review the crawled content in: ${options.outputDir || 'content/entries'}/`);
      console.log(`2. Check for any failed URLs in the output above`);
      console.log(`3. Restart your development server: npm run dev`);
      console.log(`4. Test the new content in your chat interface`);
    } else {
      console.log(`\n⚠️ No content was successfully crawled.`);
      console.log(`Check the error messages above and try adjusting your options.`);
    }

  } catch (error) {
    console.error(`\n❌ Crawl failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(`❌ Unexpected error: ${error}`);
  process.exit(1);
});

export { main };
