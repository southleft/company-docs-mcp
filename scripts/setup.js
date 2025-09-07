#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_PATH = path.join(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.join(process.cwd(), '.env.example');

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 Company Docs MCP - Interactive Setup Wizard        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

This wizard will help you set up your documentation assistant.
Let's get started!
`);

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupEnvironment() {
  // Check if .env already exists
  if (fs.existsSync(ENV_PATH)) {
    const overwrite = await question('\n⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Keeping existing .env file.');
      return false;
    }
  }

  // Copy .env.example to .env
  if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
    console.log('✅ Created .env file from template');
  } else {
    console.error('❌ .env.example not found!');
    process.exit(1);
  }

  return true;
}

async function configureOrganization() {
  console.log('\n📋 Organization Configuration\n');
  
  const orgName = await question('Organization name (e.g., "Acme Corp"): ');
  const orgDomain = await question('Organization domain (e.g., "acme.com"): ');
  const orgLogo = await question('Logo URL (optional, press Enter to skip): ');
  const orgTagline = await question('Tagline (optional, press Enter for default): ');

  // Update .env file
  let envContent = fs.readFileSync(ENV_PATH, 'utf8');
  
  envContent = envContent.replace(/ORGANIZATION_NAME=".*"/, `ORGANIZATION_NAME="${orgName}"`);
  envContent = envContent.replace(/ORGANIZATION_DOMAIN=".*"/, `ORGANIZATION_DOMAIN="${orgDomain}"`);
  
  if (orgLogo) {
    envContent = envContent.replace(/ORGANIZATION_LOGO_URL=".*"/, `ORGANIZATION_LOGO_URL="${orgLogo}"`);
  }
  
  if (orgTagline) {
    envContent = envContent.replace(/ORGANIZATION_TAGLINE=".*"/, `ORGANIZATION_TAGLINE="${orgTagline}"`);
  }

  fs.writeFileSync(ENV_PATH, envContent);
  console.log('✅ Organization configuration saved');
}

async function configureSupabase() {
  console.log('\n🗄️  Supabase Configuration\n');
  console.log('Create a project at https://supabase.com if you haven\'t already.');
  console.log('Find these values in Settings → API\n');

  const supabaseUrl = await question('Supabase URL: ');
  const supabaseAnonKey = await question('Supabase Anon Key: ');
  const supabaseServiceKey = await question('Supabase Service Key: ');

  // Update .env file
  let envContent = fs.readFileSync(ENV_PATH, 'utf8');
  
  envContent = envContent.replace(/SUPABASE_URL=".*"/, `SUPABASE_URL="${supabaseUrl}"`);
  envContent = envContent.replace(/SUPABASE_ANON_KEY=".*"/, `SUPABASE_ANON_KEY="${supabaseAnonKey}"`);
  envContent = envContent.replace(/SUPABASE_SERVICE_KEY=".*"/, `SUPABASE_SERVICE_KEY="${supabaseServiceKey}"`);

  fs.writeFileSync(ENV_PATH, envContent);
  console.log('✅ Supabase configuration saved');
}

async function configureOpenAI() {
  console.log('\n🤖 OpenAI Configuration\n');
  console.log('Get your API key from https://platform.openai.com/api-keys\n');

  const openaiKey = await question('OpenAI API Key (sk-...): ');

  // Update .env file
  let envContent = fs.readFileSync(ENV_PATH, 'utf8');
  envContent = envContent.replace(/OPENAI_API_KEY=".*"/, `OPENAI_API_KEY="${openaiKey}"`);

  fs.writeFileSync(ENV_PATH, envContent);
  console.log('✅ OpenAI configuration saved');
}

async function configureSlack() {
  const setupSlack = await question('\n💬 Do you want to set up Slack integration? (y/N): ');
  
  if (setupSlack.toLowerCase() !== 'y') {
    return;
  }

  console.log('\n🔧 Slack Bot Configuration\n');
  console.log('Follow the guide at: https://api.slack.com/apps');
  console.log('You\'ll need to create an app with Socket Mode enabled.\n');

  const slackBotToken = await question('Bot User OAuth Token (xoxb-...): ');
  const slackAppToken = await question('App-Level Token (xapp-...): ');
  const slackSigningSecret = await question('Signing Secret: ');

  // Update .env file
  let envContent = fs.readFileSync(ENV_PATH, 'utf8');
  
  envContent = envContent.replace(/SLACK_BOT_TOKEN=".*"/, `SLACK_BOT_TOKEN="${slackBotToken}"`);
  envContent = envContent.replace(/SLACK_APP_TOKEN=".*"/, `SLACK_APP_TOKEN="${slackAppToken}"`);
  envContent = envContent.replace(/SLACK_SIGNING_SECRET=".*"/, `SLACK_SIGNING_SECRET="${slackSigningSecret}"`);
  envContent = envContent.replace(/ENABLE_SLACK_BOT=.*/, `ENABLE_SLACK_BOT=true`);

  fs.writeFileSync(ENV_PATH, envContent);
  console.log('✅ Slack configuration saved');
}

async function showDatabaseSetup() {
  console.log('\n📊 Database Setup\n');
  console.log('Run the following command to get the SQL for your Supabase database:\n');
  console.log('  npm run db:setup\n');
  console.log('Then:\n');
  console.log('1. Go to your Supabase Dashboard → SQL Editor');
  console.log('2. Create a new query');
  console.log('3. Paste the SQL and click Run\n');
  
  await question('Press Enter when you\'ve completed the database setup...');
}

async function testConnection() {
  const runTest = await question('\n🧪 Would you like to test your configuration? (Y/n): ');
  
  if (runTest.toLowerCase() === 'n') {
    return;
  }

  console.log('\n🔄 Testing Supabase connection...');
  
  try {
    execSync('npm run test:connection', { stdio: 'inherit' });
    console.log('✅ Connection test successful!');
  } catch (error) {
    console.error('❌ Connection test failed. Please check your credentials.');
  }
}

async function showNextSteps() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                    🎉 Setup Complete!                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

Next steps:

1. 📚 Add your documentation:
   npm run ingest:markdown -- --dir=./your-docs
   npm run ingest:web -- --url=https://your-docs.com
   npm run ingest:supabase

2. 🚀 Start the server:
   npm run dev

3. 🌐 Open the chat interface:
   http://localhost:8787

4. 🤖 Connect to Claude Desktop:
   See instructions in QUICKSTART.md

5. 💬 Start Slack bot (if configured):
   npm run slack:start

Need help? Check out:
- Quick Start Guide: ./QUICKSTART.md
- Full Documentation: ./README.md
- Slack Setup: ./docs/SLACK_SETUP.md

Happy documenting! 🚀
`);
}

async function main() {
  try {
    const envCreated = await setupEnvironment();
    
    if (envCreated) {
      await configureOrganization();
      await configureSupabase();
      await configureOpenAI();
      await configureSlack();
    }
    
    await showDatabaseSetup();
    await testConnection();
    await showNextSteps();
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the setup
main();
