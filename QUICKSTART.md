# Quick Start Guide

Get Company Docs MCP running: ingest your markdown, deploy the MCP server, and connect it to your MCP client.

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Cloudflare account](https://dash.cloudflare.com/sign-up) — hosts the Worker and provides embeddings (free tier works)
- [Supabase account](https://supabase.com) — stores documentation vectors (free tier works)

No OpenAI or other third-party AI keys are needed.

## 1. Install

```bash
npm install company-docs-mcp
```

## 2. Set Up Supabase

Supabase stores your documentation as vectors for semantic search.

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your **Project URL**, **anon key**, and **service_role key**
3. Open the **SQL Editor**, paste the contents of [`database/schema.sql`](database/schema.sql), and run it

The schema file is in the npm package at `node_modules/company-docs-mcp/database/schema.sql`.

## 3. Set Up Cloudflare Credentials

The CLI uses your Cloudflare account for embedding generation during ingestion.

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Copy your **Account ID** from the right sidebar of the overview page
3. Go to **My Profile > API Tokens > Create Token** with **Workers AI: Read** permission
4. Copy the generated token

## 4. Configure Environment

Create a `.env` file in your project root:

```env
# Supabase — where your documentation vectors are stored
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Cloudflare — for generating embeddings during ingestion
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

## 5. Write Your Documentation

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

## 6. Ingest and Publish

```bash
# Parse markdown files into structured entries
npx company-docs ingest markdown --dir=./docs

# Push entries to Supabase with Workers AI embeddings
npx company-docs publish
```

To preview what would be published without writing to the database:

```bash
npx company-docs publish --dry-run
```

Re-run these commands any time your docs change. The system uses content hashing — only changed entries are re-embedded.

## 7. Deploy the Cloudflare Worker

The Worker is the server that MCP clients, Slack, and the chat UI connect to. Deploy it from the repository:

### Clone and install

```bash
git clone https://github.com/southleft/company-docs-mcp.git
cd company-docs-mcp
npm install
```

### Authenticate Wrangler

```bash
npx wrangler login
```

### Configure wrangler.toml

```toml
name = "company-docs-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Workers AI binding — provides free embedding generation at query time
[ai]
binding = "AI"

[vars]
ORGANIZATION_NAME = "Your Organization"
VECTOR_SEARCH_ENABLED = "true"
VECTOR_SEARCH_MODE = "vector"
```

### Create a KV namespace (caches search results for 5 minutes)

```bash
npx wrangler kv namespace create CONTENT_CACHE
# Add the returned ID to wrangler.toml:
# [[kv_namespaces]]
# binding = "CONTENT_CACHE"
# id = "your-kv-namespace-id"
```

### Set secrets

```bash
echo "your-supabase-url" | npx wrangler secret put SUPABASE_URL
echo "your-anon-key" | npx wrangler secret put SUPABASE_ANON_KEY
echo "your-service-key" | npx wrangler secret put SUPABASE_SERVICE_KEY
```

No OpenAI key needed — the Worker uses its built-in Workers AI binding for embeddings.

### Deploy

```bash
npm run deploy
```

Your MCP server is now live at `https://company-docs-mcp.<your-subdomain>.workers.dev`.

## 8. Connect Your MCP Client

The MCP endpoint is:

```
https://company-docs-mcp.<your-subdomain>.workers.dev/mcp
```

**Claude:** Settings > Connectors > Add custom connector > paste the URL.

**Cursor / Windsurf / Other clients:** Add the URL as a remote MCP server in your client's settings.

Your client will now have access to these tools (all query Supabase directly):

| Tool | Description |
|------|-------------|
| `search_documentation` | Semantic vector search across all documentation |
| `search_chunks` | Search specific content chunks with section context |
| `browse_by_category` | Browse documentation by category (dynamic — uses whatever categories you set during ingestion) |
| `get_all_tags` | List all available tags across your documentation |

## 9. Optional: Slack Integration

The deployed Worker includes a `/slack` webhook endpoint for slash commands.

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

See [docs/SLACK_SETUP.md](docs/SLACK_SETUP.md) for details.

## Troubleshooting

**No results from search**
- Confirm `npx company-docs publish` completed without errors
- Check that `.env` has the correct Supabase credentials
- Run `npx company-docs publish --dry-run` to inspect entries

**Embedding errors during publish**
- Verify `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set in `.env`
- Test your token: `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify`

**Wrangler login fails**
- Check for a `CLOUDFLARE_API_TOKEN` in your environment that may conflict with OAuth
- Comment it out, run `wrangler login`, then restore it

**MCP client not connecting**
- Ensure the Worker is deployed and reachable
- Use the `/mcp` path in the connector URL, not the root
- Restart your MCP client after adding the connector

**Slack not responding**
- Confirm the Request URL in your Slack app points to `https://<your-worker>/slack`
- Verify `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET` are set as Worker secrets
- Check Worker logs with `npx wrangler tail`

## Next Steps

- [README.md](./README.md) — full documentation, architecture, and CLI reference
- [docs/BRANDING.md](./docs/BRANDING.md) — customize the chat interface
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — production deployment details
- [docs/SLACK_SETUP.md](./docs/SLACK_SETUP.md) — Slack integration reference
- [docs/SECURITY_KEY_ROTATION.md](./docs/SECURITY_KEY_ROTATION.md) — credential rotation
- [GitHub Issues](https://github.com/southleft/company-docs-mcp/issues) — report bugs or request features
