#!/usr/bin/env tsx
/**
 * Script to ingest content into Supabase with vector embeddings
 * Uses the correct table name: design_system_content
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { loadAllContentEntries } from '../src/lib/content-loader';
import { ContentEntry } from '../types/content';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191), // Max tokens for embedding model
  });
  return response.data[0].embedding;
}

/**
 * Chunk text for granular search
 */
function chunkText(text: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

async function main() {
  console.log('🚀 Starting Supabase Vector Ingestion');
  console.log('📊 Table: design_system_content');
  console.log('');

  // Check if table exists
  const { count: existingCount } = await supabase
    .from('design_system_content')
    .select('*', { count: 'exact', head: true });
  
  if (existingCount === null) {
    console.error('❌ Table "design_system_content" does not exist!');
    console.error('Please run the SQL in SUPABASE_SETUP.md first.');
    process.exit(1);
  }

  console.log(`📚 Found ${existingCount} existing documents in database`);
  
  // Clear existing data
  if (existingCount > 0) {
    console.log('🗑️  Clearing existing data...');
    const { error: deleteError } = await supabase
      .from('design_system_content')
      .delete()
      .neq('id', '');
    
    if (deleteError) {
      console.error('Error clearing data:', deleteError);
    }
  }

  // Load content
  console.log('📚 Loading content entries...');
  const entries = await loadAllContentEntries();
  console.log(`📄 Found ${entries.length} entries to process`);
  console.log('');

  let successful = 0;
  let failed = 0;
  const batchSize = 5;

  // Process in batches
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, Math.min(i + batchSize, entries.length));
    
    await Promise.all(batch.map(async (entry) => {
      try {
        // Get source info
        const sourceType = entry.source?.type || 'unknown';
        const sourcePath = entry.source?.location || entry.title;
        
        // Create chunks
        const chunks = chunkText(entry.content);
        
        // Process each chunk
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunkText = chunks[chunkIndex];
          const chunkId = chunks.length > 1 
            ? `${entry.id}_chunk_${chunkIndex}` 
            : entry.id;
          
          // Generate embedding for chunk
          const embeddingText = chunks.length > 1
            ? `${entry.title}\n\n${chunkText}`
            : `${entry.title}\n\n${entry.content}`;
          
          const embedding = await generateEmbedding(embeddingText);
          
          // Prepare record
          const record = {
            id: chunkId,
            title: entry.title,
            content: chunkText,
            source_type: sourceType,
            source_path: sourcePath,
            url: entry.source?.url || null,
            category: entry.metadata?.category || null,
            tags: entry.metadata?.tags || [],
            metadata: entry.metadata || {},
            chunk_index: chunkIndex,
            total_chunks: chunks.length,
            embedding
          };
          
          // Insert into database
          const { error } = await supabase
            .from('design_system_content')
            .upsert(record);
          
          if (error) {
            throw error;
          }
        }
        
        console.log(`✅ ${entry.title} (${chunks.length} chunks)`);
        successful++;
      } catch (error) {
        console.error(`❌ Failed: ${entry.title}`, error.message);
        failed++;
      }
    }));
    
    // Progress update
    const processed = Math.min(i + batchSize, entries.length);
    console.log(`Progress: ${processed}/${entries.length} entries processed`);
  }

  console.log('');
  console.log('📊 Results:');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  // Verify final count
  const { count: finalCount } = await supabase
    .from('design_system_content')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📚 Total documents in database: ${finalCount}`);
  
  if (successful > 0) {
    console.log('');
    console.log('🎉 Ingestion completed successfully!');
    console.log('Your Supabase vector search is now ready to use.');
  }
}

main().catch(console.error);