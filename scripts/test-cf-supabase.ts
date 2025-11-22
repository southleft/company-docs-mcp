#!/usr/bin/env tsx
/**
 * Test Supabase using the EXACT same approach as CloudFlare Worker
 */

async function testCFSupabase() {
  console.log('🧪 Testing Supabase Connection (CF Worker Style)\n');

  // Use the exact same values from wrangler.toml
  const supabaseUrl = "https://dflbcieneduppihytwkr.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbGJjaWVuZWR1cHBpaHl0d2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwODMzNjQsImV4cCI6MjA3MjY1OTM2NH0.gHkERJlkKTMxnZupYmbq1-EQvRE9uCR8ctt5MEDIkUk";
  const openaiKey = process.env.OPENAI_API_KEY!;

  console.log('Config:', {
    supabaseUrl,
    hasKey: !!supabaseKey,
    hasOpenAI: !!openaiKey
  });

  // Import exactly as Worker does
  const { createClient } = await import('@supabase/supabase-js');
  const OpenAIModule = await import('openai');
  const OpenAI = OpenAIModule.default;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  console.log('\n1. Testing basic table access...');
  const { data: testData, error: testError } = await supabase
    .from('content_entries')
    .select('id, title')
    .limit(1);

  if (testError) {
    console.error('❌ Table access error:', testError);
    return;
  }
  console.log('✅ Table accessible, sample:', testData?.[0]?.title);

  console.log('\n2. Generating embedding...');
  const query = "tokens";
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;
  console.log(`✅ Embedding generated (length: ${queryEmbedding.length})`);

  console.log('\n3. Calling search_content RPC...');
  const { data, error } = await supabase.rpc('search_content', {
    query_embedding: queryEmbedding,
    query_text: query,
    match_threshold: 0.15,
    match_count: 10,
    filter_category: null,
    filter_tags: null
  });

  console.log('\nRPC Result:', {
    hasError: !!error,
    errorMessage: error?.message,
    errorCode: error?.code,
    errorDetails: error?.details,
    errorHint: error?.hint,
    dataLength: data?.length || 0,
    firstResult: data?.[0]?.title
  });

  if (data && data.length > 0) {
    console.log('\n✅ SUCCESS! Found results:');
    data.slice(0, 3).forEach((r: any, i: number) => {
      console.log(`   ${i + 1}. ${r.title} (${(r.similarity * 100).toFixed(1)}%)`);
    });
  } else if (error) {
    console.error('\n❌ RPC Error:', error);
  } else {
    console.log('\n⚠️  No results but no error - this is the CloudFlare issue!');
  }
}

testCFSupabase().catch(console.error);
