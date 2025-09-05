#!/usr/bin/env tsx
/**
 * Script to ingest content into Supabase with vector embeddings
 * Usage: npm run ingest:vectors -- [options]
 */

import { config } from 'dotenv';
import { ingestContent } from '../src/lib/vector-ingestion';

// Load environment variables
config();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  batchSize: 10,
  chunkSize: 1000,
  clearExisting: false,
  verbose: false,
  dryRun: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--batch-size':
      options.batchSize = parseInt(args[++i]) || 10;
      break;
    case '--chunk-size':
      options.chunkSize = parseInt(args[++i]) || 1000;
      break;
    case '--clear':
      options.clearExisting = true;
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--help':
    case '-h':
      console.log(`
📚 Design Systems MCP - Vector Ingestion Script

Usage: npm run ingest:vectors -- [options]

Options:
  --batch-size <n>   Number of entries to process in parallel (default: 10)
  --chunk-size <n>   Size of text chunks for granular search (default: 1000)
  --clear            Clear existing data before ingesting
  --verbose, -v      Show detailed progress
  --dry-run          Simulate ingestion without uploading data
  --help, -h         Show this help message

Examples:
  # Basic ingestion
  npm run ingest:vectors

  # Clear and re-ingest with verbose output
  npm run ingest:vectors -- --clear --verbose

  # Dry run to estimate costs
  npm run ingest:vectors -- --dry-run --verbose

  # Custom batch size for rate limiting
  npm run ingest:vectors -- --batch-size 5
`);
      process.exit(0);
  }
}

// Validate environment
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OpenAI API key!');
  console.error('Please set OPENAI_API_KEY in your .env file');
  process.exit(1);
}

// Run ingestion
async function main() {
  console.log('🚀 Starting Design Systems MCP Vector Ingestion');
  console.log('📊 Configuration:', options);
  console.log('');

  try {
    const result = await ingestContent(options);
    
    if (result.failed > 0) {
      console.error(`\n⚠️  ${result.failed} entries failed to process`);
      process.exit(1);
    }
    
    console.log('\n✅ Ingestion completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Ingestion failed:', error);
    process.exit(1);
  }
}

main();