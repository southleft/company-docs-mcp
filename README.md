# Company Docs MCP

A self-hosted MCP (Model Context Protocol) server that makes your organization's documentation accessible through AI assistants like Claude Desktop. Includes optional Slack bot integration for team-wide access.

## Features

- 🔍 **Semantic Search**: Vector-based search using OpenAI embeddings for intelligent documentation retrieval
- 📚 **Multiple Content Sources**: Ingest from Markdown files, websites, PDFs, GitHub repos, and more
- 🤖 **Claude Desktop Integration**: Connect your docs directly to Claude Desktop via MCP
- 💬 **Slack Bot** (Optional): Team members can query documentation via Slack slash commands
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

Choose one or more ingestion methods:

#### From Local Markdown Files
```bash
npm run ingest:markdown -- --dir=./docs
```

#### From GitHub Repository
```bash
npm run ingest:github -- --repo=your-org/documentation
```

#### From Website
```bash
npm run ingest:web -- --url=https://docs.yourcompany.com
```

#### From PDFs
```bash
npm run ingest:pdf -- --file=./documentation.pdf
```

#### Generate Vector Embeddings
After ingesting content, generate embeddings for semantic search:
```bash
npm run ingest:supabase
```

### 4. Test Locally

```bash
# Start the MCP server locally
npm run dev

# Test with sample queries
npm run test:local
```

### 5. Connect to Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "company-docs": {
      "command": "node",
      "args": ["/path/to/company-docs-mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

Or if deployed to Cloudflare:

```json
{
  "mcpServers": {
    "company-docs": {
      "url": "https://your-worker.workers.dev/mcp"
    }
  }
}
```

## Deployment

### Deploy to Cloudflare Workers

1. Configure `wrangler.toml`:

```toml
name = "company-docs-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ORGANIZATION_NAME = "Your Company"

[[kv_namespaces]]
binding = "CONTENT_CACHE"
id = "your-kv-namespace-id"
```

2. Deploy:

```bash
npm run deploy
```

Your MCP server will be available at: `https://company-docs-mcp.<your-subdomain>.workers.dev`

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