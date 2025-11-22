#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function diagnose() {
  console.log('🔍 Diagnosing Supabase Database\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Count entries
  const { count, error: countError } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total entries: ${count || 0}`);

  // Get sample entries with details
  const { data, error } = await supabase
    .from('content_entries')
    .select('id, title, category, tags, source_location, embedding')
    .limit(10);

  if (error) {
    console.error('❌ Error fetching data:', error);
    process.exit(1);
  }

  console.log('\n📚 Sample Entries:');
  data?.forEach((entry: any, i: number) => {
    console.log(`\n${i + 1}. ${entry.title}`);
    console.log(`   Category: ${entry.category || 'N/A'}`);
    console.log(`   Tags: ${entry.tags?.join(', ') || 'N/A'}`);
    console.log(`   Source: ${entry.source_location || 'N/A'}`);
    console.log(`   Has Embedding: ${entry.embedding ? 'Yes' : 'NO ❌'}`);
  });

  // Check embeddings coverage
  const { data: embedData } = await supabase
    .from('content_entries')
    .select('id, title, embedding')
    .is('embedding', null)
    .limit(5);

  if (embedData && embedData.length > 0) {
    console.log('\n⚠️  Entries WITHOUT embeddings:');
    embedData.forEach((entry: any) => {
      console.log(`   - ${entry.title}`);
    });
  }

  // Test a sample search
  console.log('\n🔍 Testing search functionality...');
  
  const { data: searchData, error: searchError } = await supabase
    .from('content_entries')
    .select('id, title, category')
    .textSearch('title', 'tokens', { type: 'websearch' })
    .limit(3);

  if (searchError) {
    console.log('❌ Text search error:', searchError.message);
  } else if (searchData) {
    console.log(`✅ Text search works! Found ${searchData.length} results for "tokens"`);
    searchData.forEach((r: any) => console.log(`   - ${r.title}`));
  }

  // Check if vector function exists
  console.log('\n🧪 Checking vector search function...');
  try {
    const { data: funcData, error: funcError } = await supabase
      .rpc('search_content', {
        query_embedding: new Array(1536).fill(0),
        query_text: 'test',
        match_threshold: 0.1,
        match_count: 1
      });
    
    if (funcError) {
      console.log('❌ Vector search function error:', funcError.message);
    } else {
      console.log('✅ Vector search function exists and works!');
    }
  } catch (e: any) {
    console.log('❌ Error calling search_content:', e.message);
  }

  console.log('\n✅ Diagnosis complete!');
}

diagnose().catch(console.error);
