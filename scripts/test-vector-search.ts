#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function testVectorSearch() {
  console.log('🔍 Testing Vector Search with Real Query\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('❌ Missing credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  const testQuery = "Where can I find more information on tokens?";
  console.log(`Query: "${testQuery}"\n`);

  // Generate embedding
  console.log('Generating embedding...');
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: testQuery,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log(`✅ Embedding generated (length: ${queryEmbedding.length})\n`);

  // Test the search_content function
  console.log('Calling search_content RPC function...');
  const { data, error } = await supabase.rpc('search_content', {
    query_embedding: queryEmbedding,
    query_text: testQuery,
    match_threshold: 0.15,
    match_count: 10,
    filter_category: null,
    filter_tags: null
  });

  if (error) {
    console.error('❌ RPC Error:', error);
    return;
  }

  console.log(`✅ Search completed! Found ${data?.length || 0} results\n`);

  if (data && data.length > 0) {
    console.log('Top 5 Results:\n');
    data.slice(0, 5).forEach((result: any, i: number) => {
      console.log(`${i + 1}. ${result.title}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   Category: ${result.category}`);
      console.log(`   Content preview: ${result.content?.slice(0, 100)}...`);
      console.log('');
    });
  } else {
    console.log('❌ No results found!');
    console.log('\nTrying with lower threshold (0.01)...');
    
    const { data: data2, error: error2 } = await supabase.rpc('search_content', {
      query_embedding: queryEmbedding,
      query_text: testQuery,
      match_threshold: 0.01,
      match_count: 5,
      filter_category: null,
      filter_tags: null
    });
    
    if (!error2 && data2 && data2.length > 0) {
      console.log(`Found ${data2.length} results with lower threshold:\n`);
      data2.forEach((result: any, i: number) => {
        console.log(`${i + 1}. ${result.title} (${(result.similarity * 100).toFixed(1)}%)`);
      });
    }
  }
}

testVectorSearch().catch(console.error);
