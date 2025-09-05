#!/usr/bin/env tsx
/**
 * Markdown content ingestion script
 * Handles ingesting markdown files from a specified directory
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ContentEntry, ContentMetadata, SourceType } from '../../src/lib/content';
import { parseMarkdown } from './markdown-parser';
import { minimist } from './deps';

// Parse command line arguments
function parseArgs() {
  const argv = minimist(process.argv.slice(2));
  return {
    dir: argv.dir || argv.d || './docs',
    category: argv.category || argv.c || 'documentation',
    recursive: argv.recursive !== false, // Default to true
    verbose: argv.verbose || argv.v || false,
    help: argv.help || argv.h || false,
  };
}

// Display help message
function showHelp() {
  console.log(`
Markdown Ingestion Tool
-----------------------
Ingests markdown files from a directory into the content system.

Usage:
  npm run ingest:markdown -- --dir=<path> [options]
  tsx scripts/ingest/ingest-markdown.ts --dir=<path> [options]

Options:
  --dir, -d        Directory containing markdown files (default: ./docs)
  --category, -c   Category for the content (default: documentation)
  --recursive      Recursively search subdirectories (default: true)
  --verbose, -v    Show detailed output
  --help, -h       Show this help message

Examples:
  npm run ingest:markdown -- --dir=./docs
  npm run ingest:markdown -- --dir=./docs --category=guides
  npm run ingest:markdown -- --dir=./content/markdown --recursive=false
  `);
}

// Get all markdown files from a directory
async function getMarkdownFiles(dir: string, recursive: boolean = true): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && recursive) {
        // Recursively get files from subdirectories
        const subFiles = await getMarkdownFiles(fullPath, recursive);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.match(/\.md$/i)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

// Ensure content directories exist
async function ensureDirectories() {
  const contentDir = path.join(process.cwd(), 'content');
  const entriesDir = path.join(contentDir, 'entries');
  const rawDir = path.join(contentDir, 'raw', 'markdown');
  
  await fs.mkdir(entriesDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });
}

// Save content entry
async function saveEntry(entry: ContentEntry): Promise<void> {
  await ensureDirectories();
  
  // Generate filename
  const safeTitle = entry.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50);
  const filename = `${entry.id}-${safeTitle}.json`;
  const filepath = path.join(process.cwd(), 'content', 'entries', filename);
  
  // Save the entry
  await fs.writeFile(
    filepath,
    JSON.stringify(entry, null, 2),
    'utf-8'
  );
  
  console.log(`✓ Saved: ${filename}`);
}

// Save raw markdown file
async function saveRawMarkdown(sourcePath: string, content: string): Promise<void> {
  const filename = path.basename(sourcePath);
  const rawPath = path.join(process.cwd(), 'content', 'raw', 'markdown', filename);
  
  await fs.writeFile(rawPath, content, 'utf-8');
}

// Main function
async function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  console.log('Markdown Ingestion Starting...');
  console.log(`Directory: ${args.dir}`);
  console.log(`Category: ${args.category}`);
  console.log(`Recursive: ${args.recursive}`);
  console.log('----------------------------\n');
  
  // Resolve the directory path
  const dirPath = path.resolve(args.dir);
  
  // Check if directory exists
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      console.error(`Error: ${dirPath} is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: Directory ${dirPath} does not exist`);
    process.exit(1);
  }
  
  // Get all markdown files
  const markdownFiles = await getMarkdownFiles(dirPath, args.recursive);
  
  if (markdownFiles.length === 0) {
    console.log('No markdown files found in the specified directory.');
    process.exit(0);
  }
  
  console.log(`Found ${markdownFiles.length} markdown file(s)\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process each markdown file
  for (const filePath of markdownFiles) {
    const relativePath = path.relative(dirPath, filePath);
    
    if (args.verbose) {
      console.log(`Processing: ${relativePath}`);
    }
    
    try {
      // Read the markdown file
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Parse the markdown content
      const entry = await parseMarkdown(content, filePath, {
        metadata: {
          category: args.category,
        } as Partial<ContentMetadata>,
      });
      
      // Save the entry
      await saveEntry(entry);
      
      // Save raw markdown
      await saveRawMarkdown(filePath, content);
      
      successCount++;
    } catch (error) {
      console.error(`✗ Error processing ${relativePath}:`, error);
      errorCount++;
    }
  }
  
  // Summary
  console.log('\n----------------------------');
  console.log('Ingestion Complete!');
  console.log(`✓ Successfully ingested: ${successCount} file(s)`);
  if (errorCount > 0) {
    console.log(`✗ Failed: ${errorCount} file(s)`);
  }
}

// Export for use as a module
export { getMarkdownFiles, parseArgs };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
