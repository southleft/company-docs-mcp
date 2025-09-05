#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
};

const confirm = async (prompt: string): Promise<boolean> => {
  const answer = await question(`${prompt} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
};

interface Config {
  organizationName: string;
  organizationDomain: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  openaiApiKey: string;
  enableSlackBot: boolean;
  slackBotToken?: string;
  slackAppToken?: string;
  slackSigningSecret?: string;
  deployToCloudflare: boolean;
  cloudflareAccountId?: string;
  workerName?: string;
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion < 18) {
    console.error('❌ Node.js 18+ is required. Current version:', nodeVersion);
    process.exit(1);
  }
  console.log('✅ Node.js version:', nodeVersion);
  
  // Check if .env already exists
  const envExists = await fs.access('.env').then(() => true).catch(() => false);
  if (envExists) {
    const overwrite = await confirm('\n⚠️  .env file already exists. Overwrite?');
    if (!overwrite) {
      console.log('Setup cancelled.');
      process.exit(0);
    }
  }
}

async function gatherConfig(): Promise<Config> {
  console.log('\n📝 Configuration Setup\n');
  console.log('Press Enter to use [default] values.\n');
  
  const config: Config = {
    organizationName: await question('Organization name: ') || 'My Company',
    organizationDomain: await question('Organization domain (e.g., company.com): ') || 'example.com',
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceKey: '',
    openaiApiKey: '',
    enableSlackBot: false,
    deployToCloudflare: false
  };
  
  // Supabase configuration
  console.log('\n🗄️  Supabase Configuration');
  console.log('Create a project at https://supabase.com if you haven\'t already.\n');
  
  config.supabaseUrl = await question('Supabase URL: ');
  config.supabaseAnonKey = await question('Supabase Anon Key: ');
  config.supabaseServiceKey = await question('Supabase Service Key: ');
  
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.supabaseServiceKey) {
    console.error('❌ Supabase configuration is required.');
    process.exit(1);
  }
  
  // OpenAI configuration
  console.log('\n🤖 OpenAI Configuration');
  console.log('Get your API key from https://platform.openai.com/api-keys\n');
  
  config.openaiApiKey = await question('OpenAI API Key (sk-...): ');
  if (!config.openaiApiKey) {
    console.warn('⚠️  OpenAI API key not provided. Vector search will be disabled.');
  }
  
  // Slack bot configuration
  config.enableSlackBot = await confirm('\n💬 Enable Slack bot integration?');
  if (config.enableSlackBot) {
    console.log('\nSlack Bot Configuration');
    console.log('Create an app at https://api.slack.com/apps\n');
    
    config.slackBotToken = await question('Slack Bot Token (xoxb-...): ');
    config.slackAppToken = await question('Slack App Token (xapp-...): ');
    config.slackSigningSecret = await question('Slack Signing Secret: ');
  }
  
  // Cloudflare deployment
  config.deployToCloudflare = await confirm('\n☁️  Deploy to Cloudflare Workers?');
  if (config.deployToCloudflare) {
    console.log('\nCloudflare Configuration');
    config.cloudflareAccountId = await question('Cloudflare Account ID: ');
    config.workerName = await question('Worker name [company-docs-mcp]: ') || 'company-docs-mcp';
  }
  
  return config;
}

async function createEnvFile(config: Config) {
  console.log('\n📄 Creating .env file...');
  
  const envContent = `# Organization Configuration
ORGANIZATION_NAME="${config.organizationName}"
ORGANIZATION_DOMAIN="${config.organizationDomain}"

# Supabase Configuration
SUPABASE_URL="${config.supabaseUrl}"
SUPABASE_ANON_KEY="${config.supabaseAnonKey}"
SUPABASE_SERVICE_KEY="${config.supabaseServiceKey}"

# OpenAI Configuration
OPENAI_API_KEY="${config.openaiApiKey}"
OPENAI_MODEL="text-embedding-3-small"

# Cloudflare Workers (if deploying to Cloudflare)
CLOUDFLARE_ACCOUNT_ID="${config.cloudflareAccountId || ''}"
WORKER_NAME="${config.workerName || 'company-docs-mcp'}"

# Slack Bot Configuration
SLACK_BOT_TOKEN="${config.slackBotToken || ''}"
SLACK_APP_TOKEN="${config.slackAppToken || ''}"
SLACK_SIGNING_SECRET="${config.slackSigningSecret || ''}"
SLACK_SLASH_COMMAND="/docs"
ENABLE_SLACK_BOT=${config.enableSlackBot}

# MCP Server Configuration
MCP_SERVER_PORT=3000
MCP_SERVER_HOST="localhost"
MCP_TIMEOUT_MS=10000

# Feature Flags
ENABLE_VECTOR_SEARCH=${config.openaiApiKey ? 'true' : 'false'}
ENABLE_ANALYTICS=false
DEBUG_MODE=false
`;
  
  await fs.writeFile('.env', envContent);
  console.log('✅ .env file created');
}

async function setupSupabaseDatabase(config: Config) {
  console.log('\n🗄️  Setting up Supabase database...');
  
  // Test connection
  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    
    // Test the connection with a simple query
    const { error: testError } = await supabase.from('content_entries').select('count').limit(1);
    
    if (testError && testError.code === '42P01') { // Table doesn't exist
      console.log('\n📋 Database tables not found. Please set them up:');
      console.log('\n──────────────────────────────────────────');
      console.log('Option 1: Automatic Setup (Recommended)');
      console.log('──────────────────────────────────────────');
      console.log('Run: npm run db:setup');
      console.log('\n──────────────────────────────────────────');
      console.log('Option 2: Manual Setup');
      console.log('──────────────────────────────────────────');
      console.log('1. Go to your Supabase dashboard: ' + config.supabaseUrl);
      console.log('2. Navigate to SQL Editor');
      console.log('3. Create a new query');
      console.log('4. Copy and paste the contents of database/schema.sql');
      console.log('5. Click "Run" to execute the SQL');
      console.log('\n✨ After setting up the database, you can start ingesting content!');
    } else if (testError) {
      console.error('⚠️  Could not connect to Supabase:', testError.message);
      console.log('\nPlease verify your Supabase credentials are correct.');
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('✅ Database tables already exist');
    }
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error);
    console.log('\nPlease verify:');
    console.log('1. Your Supabase URL is correct');
    console.log('2. Your API keys are valid');
    console.log('3. Your Supabase project is active');
  }
}

async function createWranglerToml(config: Config) {
  if (!config.deployToCloudflare) return;
  
  console.log('\n📝 Creating wrangler.toml...');
  
  const wranglerContent = `name = "${config.workerName}"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

[vars]
ORGANIZATION_NAME = "${config.organizationName}"
ORGANIZATION_DOMAIN = "${config.organizationDomain}"
SUPABASE_URL = "${config.supabaseUrl}"
SUPABASE_ANON_KEY = "${config.supabaseAnonKey}"

[[kv_namespaces]]
binding = "CONTENT_CACHE"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_KV_PREVIEW_ID"

[ai]
binding = "AI"
`;
  
  await fs.writeFile('wrangler.toml', wranglerContent);
  console.log('✅ wrangler.toml created');
  console.log('\n⚠️  Remember to create KV namespace: wrangler kv:namespace create CONTENT_CACHE');
}

async function createExampleContent() {
  console.log('\n📚 Creating example content...');
  
  const exampleDir = 'examples/sample-docs';
  await fs.mkdir(exampleDir, { recursive: true });
  
  const gettingStarted = `---
title: Getting Started with Our Platform
category: Documentation
tags: [setup, quickstart, installation]
---

# Getting Started

Welcome to our platform documentation! This guide will help you get started quickly.

## Installation

To install our platform, follow these steps:

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Run the application

## Quick Start

Here's a simple example to get you started:

\`\`\`bash
npm install
npm run setup
npm start
\`\`\`

## Next Steps

- Read the [API Documentation](./api-reference.md)
- Check out our [Best Practices](./best-practices.md)
- Join our community forums
`;
  
  await fs.writeFile(path.join(exampleDir, 'getting-started.md'), gettingStarted);
  
  const apiReference = `---
title: API Reference
category: API
tags: [api, endpoints, reference]
---

# API Reference

## Authentication

All API requests require authentication using an API key.

### Headers

\`\`\`http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
\`\`\`

## Endpoints

### GET /api/users

Retrieve a list of users.

**Response:**
\`\`\`json
{
  "users": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
\`\`\`

### POST /api/users

Create a new user.

**Request Body:**
\`\`\`json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
\`\`\`
`;
  
  await fs.writeFile(path.join(exampleDir, 'api-reference.md'), apiReference);
  
  console.log('✅ Example documentation created in examples/sample-docs/');
}

async function printNextSteps(config: Config) {
  console.log('\n✨ Setup Complete!\n');
  console.log('Next steps:\n');
  console.log('1. Set up your database tables:');
  console.log('   npm run db:setup');
  console.log('   (Follow the instructions to run the SQL in Supabase)\n');
  
  console.log('2. Ingest your documentation:');
  console.log('   npm run ingest:markdown -- --dir=./your-docs');
  console.log('   npm run ingest:supabase  # Generate embeddings\n');
  
  console.log('3. Test locally:');
  console.log('   npm run dev\n');
  
  if (config.deployToCloudflare) {
    console.log('4. Deploy to Cloudflare:');
    console.log('   wrangler kv:namespace create CONTENT_CACHE');
    console.log('   npm run deploy\n');
  }
  
  if (config.enableSlackBot) {
    console.log('5. Start Slack bot:');
    console.log('   npm run slack:start\n');
  }
  
  console.log('📖 See README.md for detailed documentation.');
}

async function main() {
  console.log('🚀 Company Docs MCP Setup Wizard\n');
  
  try {
    await checkPrerequisites();
    const config = await gatherConfig();
    await createEnvFile(config);
    await setupSupabaseDatabase(config);
    await createWranglerToml(config);
    await createExampleContent();
    await printNextSteps(config);
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();