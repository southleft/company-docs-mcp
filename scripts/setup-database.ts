#!/usr/bin/env tsx

import { config } from 'dotenv';
import { promises as fs } from 'fs';
import * as path from 'path';

// Load environment variables
config();

async function setupDatabase() {
  console.log('🗄️  Supabase Database Setup\n');
  console.log('This script will help you set up your database tables.\n');
  
  // Check if .env exists
  try {
    await fs.access('.env');
  } catch {
    console.error('❌ .env file not found!');
    console.log('Please run "npm run setup" first to create your configuration.');
    process.exit(1);
  }
  
  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Supabase credentials not found in .env file!');
    console.log('Please run "npm run setup" to configure your credentials.');
    process.exit(1);
  }
  
  // Read the schema file
  const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
  let schema: string;
  
  try {
    schema = await fs.readFile(schemaPath, 'utf-8');
  } catch (error) {
    console.error('❌ Could not read database/schema.sql');
    process.exit(1);
  }
  
  console.log('📋 Database Schema Ready\n');
  console.log('Since Supabase doesn\'t allow direct SQL execution via the client SDK,');
  console.log('you need to run the schema manually in the Supabase SQL Editor.\n');
  
  console.log('──────────────────────────────────────────');
  console.log('📌 Instructions:');
  console.log('──────────────────────────────────────────\n');
  
  console.log('1. Open your Supabase Dashboard:');
  console.log(`   ${process.env.SUPABASE_URL?.replace('/rest/v1', '')}\n`);
  
  console.log('2. Navigate to the SQL Editor (left sidebar)\n');
  
  console.log('3. Click "New query"\n');
  
  console.log('4. Copy and paste the following SQL:\n');
  
  console.log('──────────────────────────────────────────');
  console.log('📄 SQL SCHEMA (Copy everything below):');
  console.log('──────────────────────────────────────────\n');
  
  // Output the schema for easy copying
  console.log(schema);
  
  console.log('\n──────────────────────────────────────────');
  console.log('5. Click the "Run" button to execute the SQL\n');
  
  console.log('✅ Once complete, you\'ll see success messages in the Supabase console.\n');
  
  console.log('──────────────────────────────────────────');
  console.log('🎉 Next Steps:');
  console.log('──────────────────────────────────────────\n');
  console.log('1. Ingest your documentation:');
  console.log('   npm run ingest:markdown -- --dir=./docs\n');
  
  console.log('2. Generate embeddings:');
  console.log('   npm run ingest:supabase\n');
  
  console.log('3. Test locally:');
  console.log('   npm run dev\n');
  
  console.log('💡 Tip: Save the SQL to a file for future reference:');
  console.log('   npm run db:setup > my-schema.sql');
}

// Alternative: Output just the SQL for piping
if (process.argv.includes('--sql-only')) {
  fs.readFile(path.join(process.cwd(), 'database', 'schema.sql'), 'utf-8')
    .then(schema => {
      console.log(schema);
    })
    .catch(error => {
      console.error('Error reading schema:', error);
      process.exit(1);
    });
} else {
  setupDatabase().catch(console.error);
}