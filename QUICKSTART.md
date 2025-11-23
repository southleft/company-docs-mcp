# 🚀 Quick Start Guide

Get your organization's documentation assistant running in **under 15 minutes**!

## Prerequisites

Before starting, ensure you have:
- ✅ Node.js 18+ installed ([download here](https://nodejs.org/))
- ✅ A [Supabase account](https://supabase.com) (free tier works great)
- ✅ An [OpenAI API key](https://platform.openai.com/api-keys) for embeddings
- ✅ (Optional) [Cloudflare account](https://dash.cloudflare.com/sign-up) for deployment
- ✅ (Optional) Slack workspace admin access for bot integration

## Step 1: Clone & Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/southleft/company-docs-mcp.git
cd company-docs-mcp

# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env
```

## Step 2: Set Up Supabase (5 minutes)

### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to initialize (takes ~2 minutes)
3. Navigate to **Settings → API** in your Supabase dashboard
4. Copy these values to your `.env` file:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY`

### Initialize the Database

Run this command to create the required tables:

```bash
npm run db:setup
```

This will display SQL that you need to run in Supabase:
1. Go to your Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Paste the SQL from the command output
4. Click **Run**

## Step 3: Configure Your Organization (2 minutes)

Edit your `.env` file with your organization's details:

```bash
# Organization Configuration
ORGANIZATION_NAME="Your Company Name"
ORGANIZATION_DOMAIN="yourcompany.com"

# Optional Branding
ORGANIZATION_LOGO_URL="https://yourcompany.com/logo.png"
ORGANIZATION_SUBTITLE="Your AI Documentation Assistant"
ORGANIZATION_TAGLINE="Get instant answers about our products and APIs"

# OpenAI Configuration (required for embeddings)
OPENAI_API_KEY="sk-..."  # Get from https://platform.openai.com/api-keys
```

## Step 4: Add Your Documentation (3 minutes)

Choose one or more methods to import your documentation:

### Option A: Markdown Files
If you have documentation in markdown files:
```bash
npm run ingest:markdown -- --dir=./path/to/your/docs
```

### Option B: Website
To scrape documentation from a website:
```bash
npm run ingest:web -- https://docs.yourcompany.com
```

### Option C: GitHub Repository
For documentation in a GitHub repo:
```bash
npm run ingest:github -- --repo=your-org/docs-repo
```

### Generate Search Embeddings
After importing content, generate embeddings for AI search:
```bash
npm run ingest:supabase
```

## Step 5: Test Locally (2 minutes)

Start the development server:
```bash
npm run dev
```

Open your browser to:
- **Chat Interface**: http://localhost:8787
- **Health Check**: http://localhost:8787/health

Try asking questions like:
- "How do I get started?"
- "What are the API endpoints?"
- "Show me authentication examples"

## Step 6: Connect to Claude Desktop

**Important:** Claude Desktop does NOT support remote MCP servers directly via a "url" property. You need to use a local bridge process.

### Option A: Using mcp-remote Package (Recommended)

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "Company Docs": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://company-docs-mcp.your-subdomain.workers.dev/mcp"
      ]
    }
  }
}
```

**Note:** Replace `your-subdomain` with your actual Cloudflare Workers subdomain from `npm run deploy` output.

### Option B: Using Standalone Client (Most Reliable)

1. Copy the standalone client:
```bash
cp standalone-mcp-client.cjs /path/to/your/preferred/location/
# Edit the file to update the MCP_SERVER_URL to your deployed URL
```

2. Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "Company Docs": {
      "command": "node",
      "args": [
        "/absolute/path/to/standalone-mcp-client.cjs"
      ]
    }
  }
}
```

### Option C: Local Development Mode

For local development only (requires `npm run dev` to be running):

```json
{
  "mcpServers": {
    "company-docs": {
      "command": "node",
      "args": ["/absolute/path/to/company-docs-mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-anon-key",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

**Restart Claude Desktop** to load the MCP server.

## Step 7: Deploy to Cloudflare (Optional)

First deploy to Cloudflare:
```bash
npm run deploy
```

Your MCP server will be available at: `https://company-docs-mcp.<your-subdomain>.workers.dev`

## Step 8: Set Up Slack Bot (Optional, 5 minutes)

### Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Name it (e.g., "Docs Assistant") and select your workspace

### Configure Bot

1. Go to **OAuth & Permissions** → Add these Bot Token Scopes:
   - `commands`
   - `chat:write`
   - `chat:write.public`

2. Go to **Socket Mode** → Enable Socket Mode
   - Generate an **App-Level Token** with `connections:write` scope
   - Copy the token (starts with `xapp-`)

3. Go to **Slash Commands** → Create New Command:
   - Command: `/docs`
   - Short Description: "Search documentation"
   - Usage Hint: "[your search query]"

4. **Install App to Workspace** (in OAuth & Permissions)
   - Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### Configure Environment

Add to your `.env`:
```bash
SLACK_BOT_TOKEN="xoxb-..."  # Bot User OAuth Token
SLACK_APP_TOKEN="xapp-..."  # App-Level Token
SLACK_SIGNING_SECRET="..."  # From Basic Information page
ENABLE_SLACK_BOT=true
```

### Run the Bot

In a new terminal:
```bash
npm run slack:start
```

Test in Slack:
```
/docs how to get started
/docs API authentication
```

## 🎉 You're Done!

Your documentation assistant is now available through:
- 💬 **Chat UI**: Your branded web interface
- 🤖 **Claude Desktop**: Direct MCP integration
- 💼 **Slack**: Team-wide `/docs` commands
- 🔌 **API**: REST endpoints for custom integrations

## Troubleshooting

### "No content found"
- Ensure you've run the ingestion commands in Step 4
- Check that `npm run ingest:supabase` completed successfully
- Verify your Supabase credentials are correct

### Logo not displaying
- Ensure the logo URL is publicly accessible (HTTPS)
- Check browser console for CORS errors
- Try using a CDN-hosted image

### Slack bot not responding
- Verify Socket Mode is enabled in your Slack app
- Check that `npm run slack:start` is running
- Ensure all Slack tokens are correctly set in `.env`

### Claude Desktop not connecting
- Ensure you're not using the "url" property (not supported)
- Use mcp-remote package or standalone client as shown above
- Completely restart Claude Desktop after updating config
- Verify your deployed server is accessible

## Next Steps

- 📚 Read the [full documentation](./README.md)
- 🎨 Customize [branding](./docs/BRANDING.md)
- 🔧 Configure [advanced settings](./docs/CONFIGURATION.md)
- 🚀 [Deploy to production](./docs/DEPLOYMENT.md)
- 💬 Set up [Slack integration](./docs/SLACK_SETUP.md)

## Need Help?

- 📖 Check our [documentation](./docs/)
- 🐛 Report [issues on GitHub](https://github.com/southleft/company-docs-mcp/issues)

---

Built with ❤️ using MCP (Model Context Protocol)