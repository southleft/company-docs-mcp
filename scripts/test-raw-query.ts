#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function testRawQuery() {
  console.log('🔍 Testing Raw SQL Query\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  console.log('Connection details:');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Using Service Key: ${!!process.env.SUPABASE_SERVICE_KEY}\n`);

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try direct SQL query
  console.log('Attempting direct SQL COUNT query...');
  const { data: countData, error: countError } = await supabase
    .rpc('sql', { query: 'SELECT COUNT(*) as count FROM content_entries' })
    .single();

  if (countError) {
    console.log('Note: Direct SQL via rpc not available, using standard query...\n');
  } else {
    console.log('Count via SQL:', countData);
  }

  // Try with service key
  const { data: entries, error, count } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact' })
    .range(0, 4);

  console.log('Query result:');
  console.log('- Error:', error?.message || 'None');
  console.log('- Count:', count);
  console.log('- Rows returned:', entries?.length || 0);

  if (entries && entries.length > 0) {
    console.log('\n✅ Found data! Sample entry:');
    console.log(JSON.stringify(entries[0], null, 2));
  } else {
    console.log('\n❌ No data found in query result');
    
    // Check table existence
    console.log('\nChecking if table exists...');
    const { error: tableError } = await supabase
      .from('content_entries')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Table access error:', tableError.message);
      console.log('This might be a permissions issue or the table doesn\'t exist');
    } else {
      console.log('✅ Table exists and is accessible (but appears empty)');
    }
  }
}

testRawQuery().catch(console.error);
