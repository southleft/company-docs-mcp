# Company Docs MCP

🚀 **[Get Started in 15 Minutes →](./QUICKSTART.md)**

Transform your organization's documentation into an AI-powered knowledge base. Connect it to Claude Desktop, Slack, or use the built-in chat interface.

> **Latest Updates**: Enhanced Slack integration with comprehensive responses and clickable source links. Now supports dual-environment setup for testing with organization-specific content while maintaining a generic public repository.

![Chat Interface](./docs/assets/chat-ui-preview.png)

## Features

- 🔍 **Semantic Search**: Vector-based search using OpenAI embeddings for intelligent documentation retrieval
- 📚 **Multiple Content Sources**: Ingest from Markdown files, websites, PDFs, CSV files with URLs
- 🤖 **Claude Desktop Integration**: Connect your docs directly to Claude Desktop via MCP
- 💬 **Slack Bot** (Optional): Team members can query documentation via Slack slash commands
- 🎨 **Customizable Branding**: Add your logo and customize the chat interface with your organization's branding
- ☁️ **Flexible Deployment**: Deploy to Cloudflare Workers or run locally
- 🔐 **Private & Secure**: Your documentation stays in your infrastructure

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- [Supabase account](https://supabase.com) (free tier works)
- OpenAI API key (for embeddings)
- (Optional) Cloudflare account for deployment
- (Optional) Slack workspace admin access for bot

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/company-docs-mcp.git
cd company-docs-mcp

# Install dependencies
npm install

# Run interactive setup
npm run setup
```

The setup wizard will guide you through:
- Creating your `.env` configuration
- Testing your Supabase connection
- Configuring content sources
- (Optional) Setting up Slack integration

**For Organization-Specific Testing**: See [LOCAL_SETUP.md](LOCAL_SETUP.md) for instructions on setting up a dual-environment configuration that allows testing with your organization's branding while keeping the repository generic.

### 2. Configure Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings → API and copy:
   - Project URL → `SUPABASE_URL`
   - Anon public key → `SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_KEY`
3. Set up database tables:

```bash
# This will show you instructions and the SQL to run
npm run db:setup
```

**Manual Setup Alternative:**
- Go to your Supabase Dashboard → SQL Editor
- Create a new query
- Copy and paste the contents of `database/schema.sql`
- Click "Run" to create the tables

### 3. Ingest Your Documentation

**Important:** Content ingestion is a 2-step process:
1. **Step 1:** Ingest content from various sources (creates JSON files locally)
2. **Step 2:** Upload to Supabase with vector embeddings

#### Step 1: Ingest Content (Choose one or more methods)

##### From Local Markdown Files
```bash
npm run ingest:markdown -- --dir=./docs
```

##### From Website (Crawls entire site)
```bash
npm run ingest:web -- --url=https://docs.yourcompany.com
# Options: --max-depth 3 --max-pages 100 --delay 1000
# Note: Automatically updates manifest.json with all crawled content
```

##### From CSV File with URLs
```bash
npm run ingest:csv -- urls.csv
# Create a sample CSV: npm run ingest:csv -- --sample
```

##### From Single URL
```bash
npm run ingest:url https://example.com/page
```

##### From PDFs
```bash
npm run ingest:pdf ./documentation.pdf
```

All ingestion commands create JSON files in `content/entries/`.

**Important about Web Crawling:** The `ingest:web` command automatically updates the `content/manifest.json` file to include all crawled content. Other ingestion methods may require manual manifest updates.

#### Step 2: Upload to Supabase with Vector Embeddings
After ingesting content, upload everything to Supabase:
```bash
npm run ingest:supabase
```

**Note:** This command:
- Reads all JSON files listed in `content/manifest.json`
- Generates OpenAI embeddings for each document
- **Clears existing Supabase data** before uploading
- Uploads content with vector embeddings for semantic search
- If your content isn't uploading, check that all files are listed in the manifest

### Tips for Common Use Cases

#### Ingesting from GitHub Repository
While there's no direct GitHub ingestion, you can:
```bash
# Option 1: Clone and ingest locally
git clone https://github.com/your-org/docs.git temp-docs
npm run ingest:markdown -- --dir=./temp-docs
rm -rf temp-docs

# Option 2: If the repo has GitHub Pages
npm run ingest:web -- --url=https://your-org.github.io/docs
```

#### Combining Multiple Sources
```bash
# Ingest from multiple sources before uploading
npm run ingest:markdown -- --dir=./internal-docs
npm run ingest:csv -- external-resources.csv
npm run ingest:web -- --url=https://docs.example.com

# Then upload everything at once
npm run ingest:supabase
```

#### Incremental Updates
**Warning:** `ingest:supabase` clears all existing data. To preserve existing content:
1. Keep your JSON files in `content/entries/` as a backup
2. Add new content via ingestion commands
3. Run `ingest:supabase` to re-upload everything

### 4. Test Locally

```bash
# Start the MCP server locally
npm run dev

# Test with sample queries
npm run test:local
```

### 5. Connect to Claude Desktop

**One-Step Custom Connector Setup** (No JSON editing required!)

1. **Open Claude Desktop** → **Settings** → **Connectors**

2. **Click "Add custom connector"** at the bottom

3. **Fill in the connector details:**
   - **Name**: `Company Docs` (or your preferred name)
   - **URL**: `https://company-docs-mcp.your-subdomain.workers.dev/mcp`

4. **Click "Add"** to save

**That's it!** The connector will appear in your connectors list with 4 available tools:
- `search_design_knowledge` - Search your documentation
- `search_chunks` - Search specific content chunks
- `browse_by_category` - Browse by category
- `get_all_tags` - Get all available tags

**Note:** Replace `your-subdomain` with your actual Cloudflare Workers subdomain from the `npm run deploy` output.

**Requirements:** Custom connectors are available for Claude Pro, Team, and Enterprise plans.

## Deployment

### Deploy to Cloudflare Workers

1. Configure `wrangler.toml`:

```toml
name = "company-docs-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ORGANIZATION_NAME = "Your Company"
ORGANIZATION_DOMAIN = "yourcompany.com"
ORGANIZATION_LOGO_URL = "https://your-company.com/logo.svg"
ORGANIZATION_SUBTITLE = "Documentation Assistant"
ORGANIZATION_TAGLINE = "Your custom documentation assistant"
VECTOR_SEARCH_ENABLED = "true"
VECTOR_SEARCH_MODE = "vector"

[[kv_namespaces]]
binding = "CONTENT_CACHE"
id = "your-kv-namespace-id"

[ai]
binding = "AI"
```

2. Set secrets:

```bash
# Set your OpenAI API key and model
echo "your-openai-api-key" | npx wrangler secret put OPENAI_API_KEY
echo "gpt-4o" | npx wrangler secret put OPENAI_MODEL

# Set Supabase credentials
echo "your-supabase-url" | npx wrangler secret put SUPABASE_URL
echo "your-anon-key" | npx wrangler secret put SUPABASE_ANON_KEY
```

3. Deploy:

```bash
npm run deploy
```

Your MCP server will be available at: `https://company-docs-mcp.<your-subdomain>.workers.dev`

**For local testing with organization branding**: Use `npm run deploy:local` with your `wrangler.toml.local` configuration.

### Self-Host with Docker

```bash
docker build -t company-docs-mcp .
docker run -p 3000:3000 --env-file .env company-docs-mcp
```

## Slack Bot Setup (Optional)

There are two ways to run the Slack integration:
- Option A (local, recommended): Socket Mode — no public URL needed
- Option B (webhook): Cloudflare Worker endpoint `/slack`

See the detailed guide in [docs/SLACK_SETUP.md](docs/SLACK_SETUP.md). Quick start below.

### Option A — Local Development (Socket Mode)

1) Create a Slack app and enable Socket Mode
- Add bot scopes: `commands`, `chat:write`
- Create an App‑Level Token with `connections:write`
- Create a Slash Command (e.g., `/docs`) — with Socket Mode you do NOT need a Request URL
- Install the app to your workspace

2) Configure `.env`
```env
SLACK_BOT_TOKEN="xoxb-..."
SLACK_APP_TOKEN="xapp-..."   # App‑Level Token
SLACK_SIGNING_SECRET="..."
SLACK_SLASH_COMMAND="/docs"
MCP_ENDPOINT="http://localhost:8787"  # Bot calls the local Worker /search API
```

3) Run locally (two terminals)
```bash
# Terminal A — start the Worker (serves /search)
npm run dev

# Terminal B — start Slack Socket Mode bot
npm run slack:start
```

Usage in Slack:
```
/docs breakpoints
/docs typography
/docs switches
```
The bot will:
- Search locally via `/search`
- Use OpenAI to synthesize a polished answer
- Post a Slack‑formatted reply with a Sources list

### Option B — Webhook via Worker
- Disable Socket Mode or use a separate slash command
- Set Request URL to `https://<your-worker>.workers.dev/slack`
- Start the Worker: `npm run dev` (or `npm run deploy` for production)

Usage in Slack (same as above).

## Content Organization

Structure your documentation for optimal retrieval:

```
content/
├── getting-started/
│   ├── quickstart.md
│   └── installation.md
├── api/
│   ├── authentication.md
│   └── endpoints/
│       ├── users.md
│       └── products.md
├── guides/
│   └── best-practices.md
└── reference/
    └── configuration.md
```

### Metadata Format

Add metadata to your Markdown files for better categorization:

```markdown
---
title: API Authentication
category: API Reference
tags: [authentication, security, api]
---

# API Authentication
...
```

## Advanced Configuration

### Custom Ingestion Sources

Create custom ingestion scripts in `scripts/ingest/`:

```typescript
// scripts/ingest/ingest-confluence.ts
import { createClient } from '@supabase/supabase-js';

export async function ingestFromConfluence(spaceKey: string) {
  // Your custom ingestion logic
}
```

### Tuning Search

Adjust search parameters in `src/lib/search-handler.ts`:

```typescript
const SEARCH_CONFIG = {
  vectorSimilarityThreshold: 0.7,
  maxResults: 10,
  chunkSize: 1000,
  overlapSize: 200
};
```

## Troubleshooting

### Common Issues

**Supabase connection errors**
- Verify your Supabase URL and keys in `.env`
- Check if database migrations ran successfully

**Poor search results**
- Ensure embeddings are generated: `npm run ingest:supabase`
- Adjust similarity threshold in search config
- Check content quality and structure

**Slack bot not responding**
- Verify bot tokens and permissions
- Check if bot is added to the channel
- Review Cloudflare Workers logs if deployed

**Claude Desktop not connecting**
- Ensure you're not using the "url" property (not supported)
- Use mcp-remote package or standalone client as shown above
- Completely restart Claude Desktop after updating config
- Check that your deployed server is accessible

For detailed troubleshooting, see [docs/TROUBLESHOOTING-MCP-FIXED.md](docs/TROUBLESHOOTING-MCP-FIXED.md)

## Security Considerations

- **API Keys**: Never commit `.env` files. Use environment variables in production
- **Access Control**: Implement authentication if exposing MCP server publicly
- **Data Privacy**: Your documentation never leaves your infrastructure
- **Rate Limiting**: Configure rate limits for public endpoints

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](LICENSE) file for details

## Support

- 📖 [Documentation](docs/)
- 💬 [GitHub Issues](https://github.com/your-org/company-docs-mcp/issues)
- 📧 Email: support@yourcompany.com

## Acknowledgments

Built on top of the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic.