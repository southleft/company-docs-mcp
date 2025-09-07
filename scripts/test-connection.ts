import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🔄 Testing Supabase connection...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection by checking if tables exist
    const { data, error } = await supabase
      .from('documentation_entries')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('⚠️  Tables not found. Please run the database setup SQL.');
        console.log('   Run: npm run db:setup');
      } else {
        console.error('❌ Connection failed:', error.message);
      }
      process.exit(1);
    }

    console.log('✅ Supabase connection successful!');
    
    // Check OpenAI key
    if (process.env.OPENAI_API_KEY) {
      console.log('✅ OpenAI API key configured');
    } else {
      console.log('⚠️  OpenAI API key not configured (required for embeddings)');
    }

    // Check Slack configuration
    if (process.env.ENABLE_SLACK_BOT === 'true') {
      if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN) {
        console.log('✅ Slack bot configured');
      } else {
        console.log('⚠️  Slack bot enabled but tokens missing');
      }
    }

    console.log('\n🎉 Configuration test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testConnection();
