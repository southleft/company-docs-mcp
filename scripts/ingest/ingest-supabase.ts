#!/usr/bin/env tsx
/**
 * Script to ingest content into Supabase with vector embeddings
 * Uses the correct table name: design_system_content
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { loadAllContentEntries } from '../../src/lib/content-loader';
import { ContentEntry } from '../../src/lib/content';

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
  console.log('📊 Tables: content_entries & content_chunks');
  console.log('');

  // Check if table exists
  const { count: existingCount } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });
  
  if (existingCount === null) {
    console.error('❌ Table "content_entries" does not exist!');
    console.error('Please run the SQL from database/schema.sql in Supabase first.');
    process.exit(1);
  }

  console.log(`📚 Found ${existingCount} existing documents in database`);
  
  // Clear existing data
  if (existingCount > 0) {
    console.log('🗑️  Clearing existing data...');
    // First delete chunks (they reference entries)
    const { error: deleteChunksError } = await supabase
      .from('content_chunks')
      .delete()
      .neq('id', 0);
    
    if (deleteChunksError) {
      console.error('Error clearing chunks:', deleteChunksError);
    }
    
    // Then delete entries
    const { error: deleteError } = await supabase
      .from('content_entries')
      .delete()
      .neq('id', '');
    
    if (deleteError) {
      console.error('Error clearing entries:', deleteError);
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
        
        // First, insert the main entry
        const mainEmbedding = await generateEmbedding(`${entry.title}\n\n${entry.content}`);
        
        const entryRecord = {
          id: entry.id,
          title: entry.title,
          content: entry.content,
          source_type: sourceType,
          source_location: sourcePath,
          category: entry.metadata?.category || null,
          system_name: entry.metadata?.system_name || null,
          tags: entry.metadata?.tags || [],
          confidence: entry.metadata?.confidence || 'medium',
          embedding: mainEmbedding,
          metadata: entry.metadata || {},
          ingested_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error: entryError } = await supabase
          .from('content_entries')
          .upsert(entryRecord);
        
        if (entryError) {
          throw entryError;
        }
        
        // Then insert chunks if there are multiple
        if (chunks.length > 1) {
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunkText = chunks[chunkIndex];
            const chunkEmbedding = await generateEmbedding(chunkText);
            
            const chunkRecord = {
              entry_id: entry.id,
              chunk_index: chunkIndex,
              chunk_text: chunkText,
              embedding: chunkEmbedding,
              metadata: { chunk_size: chunkText.length },
              created_at: new Date().toISOString()
            };
            
            const { error: chunkError } = await supabase
              .from('content_chunks')
              .insert(chunkRecord);
            
            if (chunkError) {
              console.error(`Error inserting chunk ${chunkIndex}:`, chunkError);
            }
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
    .from('content_entries')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📚 Total documents in database: ${finalCount}`);
  
  if (successful > 0) {
    console.log('');
    console.log('🎉 Ingestion completed successfully!');
    console.log('Your Supabase vector search is now ready to use.');
  }
}

main().catch(console.error);