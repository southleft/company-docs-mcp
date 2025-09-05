#!/usr/bin/env tsx
/**
 * Ingest URL content and generate vector embeddings
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fetchAndParseUrl(url: string) {
  console.log(`📥 Fetching content from: ${url}`);
  
  const response = await fetch(url);
  const html = await response.text();
  
  // Simple HTML to text extraction (you might want to use a proper parser)
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : new URL(url).hostname;
  
  return { title, content: text.slice(0, 10000) }; // Limit content size
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191),
  });
  return response.data[0].embedding;
}

async function ingestUrlWithVectors(url: string) {
  try {
    // 1. Fetch and parse content
    const { title, content } = await fetchAndParseUrl(url);
    console.log(`📄 Title: ${title}`);
    console.log(`📝 Content length: ${content.length} characters`);
    
    // 2. Generate embedding
    console.log('🧮 Generating embedding...');
    const embedding = await generateEmbedding(content);
    
    // 3. Prepare entry data
    const entry = {
      id: uuidv4(),
      title,
      content,
      source_type: 'url',
      source_location: url,
      category: 'general',
      system_name: new URL(url).hostname,
      tags: ['web', 'ingested'],
      confidence: 'medium',
      embedding: JSON.stringify(embedding),
      metadata: {
        url,
        ingested_via: 'script'
      }
    };
    
    // 4. Insert into database
    console.log('💾 Saving to database...');
    const { data, error } = await supabase
      .from('content_entries')
      .insert([entry])
      .select();
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    console.log('✅ Successfully ingested with vector embedding!');
    console.log(`   ID: ${data[0].id}`);
    
    // 5. Test search
    console.log('\n🔍 Testing vector search...');
    const testQuery = 'design system';
    const queryEmbedding = await generateEmbedding(testQuery);
    
    const { data: searchResults, error: searchError } = await supabase.rpc('search_content', {
      query_embedding: queryEmbedding,
      query_text: testQuery,
      match_threshold: 0.3,
      match_count: 5
    });
    
    if (searchError) {
      console.error('❌ Search error:', searchError);
    } else if (searchResults && searchResults.length > 0) {
      console.log(`Found ${searchResults.length} results:`);
      searchResults.slice(0, 3).forEach((r: any, i: number) => {
        console.log(`   ${i+1}. ${r.title} (${(r.rank * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('No results found');
    }
    
  } catch (error) {
    console.error('❌ Error ingesting URL:', error);
  }
}

// Get URL from command line
const url = process.argv[2];
if (!url) {
  console.error('Usage: npm run ingest:url <URL>');
  process.exit(1);
}

ingestUrlWithVectors(url).catch(console.error);