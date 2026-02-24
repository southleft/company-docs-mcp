# Quick Start Guide

Get Company Docs MCP running: ingest your markdown, deploy the MCP server, and connect it to your MCP client.

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Supabase account](https://supabase.com) (free tier works)
- [OpenAI API key](https://platform.openai.com/api-keys) for generating embeddings
- [Cloudflare account](https://dash.cloudflare.com/sign-up) for deploying the Worker

## 1. Install

```bash
npm install company-docs-mcp
```

## 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your **Project URL**, **anon key**, and **service_role key**
3. Open the **SQL Editor**, paste the contents of [`database/schema.sql`](database/schema.sql), and run it

The schema file is included in the npm package at `node_modules/company-docs-mcp/database/schema.sql`.

## 3. Configure Environment

Create a `.env` file in your project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

## 4. Write Your Documentation

Create markdown files in a directory. Any structure works:

```
docs/
├── onboarding/
│   └── new-hire-checklist.md
├── engineering/
│   └── deployment-guide.md
└── policies/
    └── pto-policy.md
```

## 5. Ingest and Publish

```bash
# Parse markdown files into structured entries
npx company-docs ingest markdown --dir=./docs

# Push entries to Supabase with vector embeddings
npx company-docs publish
```

To preview what would be published without writing to the database:

```bash
npx company-docs publish --dry-run
```

Re-run these commands any time your docs change. The system uses content hashing -- only changed entries are re-embedded.

## 6. Deploy the Cloudflare Worker

The npm package handles ingestion. To serve the MCP endpoint, deploy the Cloudflare Worker from the repository.

### Clone and install

```bash
git clone https://github.com/southleft/company-docs-mcp.git
cd company-docs-mcp
npm install
```

### Configure wrangler.toml

```toml
name = "company-docs-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"

[vars]
ORGANIZATION_NAME = "Your Organization"
VECTOR_SEARCH_ENABLED = "true"
VECTOR_SEARCH_MODE = "vector"
```

### Set secrets

```bash
echo "your-openai-api-key" | npx wrangler secret put OPENAI_API_KEY
echo "your-supabase-url" | npx wrangler secret put SUPABASE_URL
echo "your-service-key" | npx wrangler secret put SUPABASE_SERVICE_KEY
```

### Deploy

```bash
npm run deploy
```

Your MCP server will be available at `https://company-docs-mcp.<your-subdomain>.workers.dev`.

## 7. Connect Your MCP Client

The MCP endpoint is:

```
https://company-docs-mcp.<your-subdomain>.workers.dev/mcp
```

**Claude:** Settings > Connectors > Add custom connector > paste the URL.

**Cursor / Windsurf / Other clients:** Add the URL as a remote MCP server in your client's settings.

Your client will now have access to these tools:

| Tool | Description |
|------|-------------|
| `search_documentation` | Semantic search across all documentation |
| `search_chunks` | Search specific content chunks |
| `browse_by_category` | Browse documentation by category |
| `get_all_tags` | List all available tags |

## 8. Optional: Slack Integration

The deployed Worker includes a `/slack` webhook endpoint for Slack slash commands. This uses standard HTTP webhooks, not Socket Mode.

### Create the Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app from scratch
2. Go to **Slash Commands** > **Create New Command**:
   - **Command**: `/docs`
   - **Request URL**: `https://company-docs-mcp.<your-subdomain>.workers.dev/slack`
   - **Short Description**: Search company documentation
   - **Usage Hint**: `[search term]`
3. Go to **OAuth & Permissions** and add these Bot Token Scopes:
   - `commands`
   - `chat:write`
   - `chat:write.public`
4. Install the app to your workspace and copy the **Bot User OAuth Token** (`xoxb-...`)
5. Copy the **Signing Secret** from **Basic Information**

### Set Slack secrets on the Worker

```bash
echo "xoxb-your-bot-token" | npx wrangler secret put SLACK_BOT_TOKEN
echo "your-signing-secret" | npx wrangler secret put SLACK_SIGNING_SECRET
```

### Test in Slack

```
/docs deployment process
/docs PTO policy
```

See [docs/SLACK_SETUP.md](docs/SLACK_SETUP.md) for details on local testing and advanced configuration.

## Troubleshooting

**No results from search**
- Confirm `npx company-docs publish` completed without errors
- Check that `.env` has the correct Supabase credentials
- Run `npx company-docs publish --dry-run` to inspect entries

**Embedding errors**
- Verify your OpenAI API key is valid and has available credits

**MCP client not connecting**
- Ensure the Worker is deployed and reachable
- Use the `/mcp` path in the connector URL, not the root
- Restart your MCP client after adding the connector

**Slack not responding**
- Confirm the Request URL in your Slack app points to `https://<your-worker>/slack`
- Verify `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` are set as Worker secrets
- Check Worker logs with `npx wrangler tail`

## Next Steps

- [README.md](./README.md) -- full documentation and CLI reference
- [docs/BRANDING.md](./docs/BRANDING.md) -- customize the chat interface
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) -- production deployment details
- [docs/SLACK_SETUP.md](./docs/SLACK_SETUP.md) -- Slack integration reference
- [docs/SECURITY_KEY_ROTATION.md](./docs/SECURITY_KEY_ROTATION.md) -- credential rotation
- [GitHub Issues](https://github.com/southleft/company-docs-mcp/issues) -- report bugs or request features
