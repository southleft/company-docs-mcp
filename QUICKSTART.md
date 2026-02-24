# Quick Start Guide

Get Company Docs MCP running: write your docs in markdown, publish them to a database, and connect your AI tools.

## What You'll Need

- [Node.js 18+](https://nodejs.org/) — the runtime that powers the CLI tool
- [Cloudflare account](https://dash.cloudflare.com/sign-up) — hosts the server and provides AI (free tier works)
- [Supabase account](https://supabase.com) — stores your documentation (free tier works)

No OpenAI or other third-party AI keys are needed.

## 1. Install

```bash
npm install company-docs-mcp
```

## 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your **Project URL**, **anon key**, and **service_role key**
3. Open the **SQL Editor**, paste the contents of [`database/schema.sql`](database/schema.sql), and run it

The schema file is in the npm package at `node_modules/company-docs-mcp/database/schema.sql`.

## 3. Log In to Cloudflare

```bash
npx wrangler login
```

A browser window will open. Log in and click **Allow**.

Then copy your **Account ID** from the right sidebar at [dash.cloudflare.com](https://dash.cloudflare.com).

## 4. Configure Environment

Create a `.env` file in your project root:

```env
# Supabase — where your documentation is stored
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Cloudflare — your Account ID
CLOUDFLARE_ACCOUNT_ID=your-account-id
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

Optionally add YAML frontmatter to control categorization:

```markdown
---
title: PTO Policy
category: hr
tags: [pto, leave, time-off]
---

# PTO Policy

Your content here...
```

## 6. Publish

```bash
# Parse markdown files
npx company-docs ingest markdown --dir=./docs

# Push to the database with AI-generated vectors
npx company-docs publish
```

To preview without writing to the database:

```bash
npx company-docs publish --dry-run
```

Re-run these commands any time your docs change. Only changed entries are re-processed.

> **If you see an authentication error:** Your wrangler login session may have expired. Run `npx wrangler login` again.

## 7. Deploy the Server

The server is what your team connects to. It runs on Cloudflare Workers.

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

### Create a search cache

```bash
npx wrangler kv namespace create CONTENT_CACHE
# Add the returned ID to wrangler.toml:
# [[kv_namespaces]]
# binding = "CONTENT_CACHE"
# id = "your-kv-namespace-id"
```

### Set database secrets

```bash
echo "your-supabase-url" | npx wrangler secret put SUPABASE_URL
echo "your-anon-key" | npx wrangler secret put SUPABASE_ANON_KEY
echo "your-service-key" | npx wrangler secret put SUPABASE_SERVICE_KEY
```

### Deploy

```bash
npm run deploy
```

Your server is now live at `https://company-docs-mcp.<your-subdomain>.workers.dev`.

## 8. Connect Your AI Tools

Share this URL with your team:

```
https://company-docs-mcp.<your-subdomain>.workers.dev/mcp
```

**Claude:** Settings > Connectors > Add custom connector > paste the URL.

**Cursor / Windsurf:** Add the URL as a remote MCP server in settings.

Your AI tools will now have access to these search capabilities:

| Tool | What it does |
|------|-------------|
| `search_documentation` | Finds documentation matching your question using semantic search |
| `search_chunks` | Searches specific sections within documents |
| `browse_by_category` | Lists documentation by category (from frontmatter or `--category` flag) |
| `get_all_tags` | Lists all tags across your documentation |

## 9. Optional: Slack Integration

```bash
echo "xoxb-your-bot-token" | npx wrangler secret put SLACK_BOT_TOKEN
echo "your-signing-secret" | npx wrangler secret put SLACK_SIGNING_SECRET
```

Then team members can search from Slack:

```
/docs deployment process
/docs PTO policy
```

See [docs/SLACK_SETUP.md](docs/SLACK_SETUP.md) for full setup instructions.

## Troubleshooting

**Authentication error when publishing** — Run `npx wrangler login` again (sessions expire periodically).

**No results from search** — Check that `npx company-docs publish` completed without errors and that your `.env` has the correct Supabase credentials.

**MCP client not connecting** — Make sure the Worker is deployed, use the `/mcp` path in the URL, and restart your MCP client after adding the connector.

## Next Steps

- [README.md](./README.md) — full documentation, architecture diagram, and CLI reference
- [docs/BRANDING.md](./docs/BRANDING.md) — customize the chat interface
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — production deployment details
- [docs/SLACK_SETUP.md](./docs/SLACK_SETUP.md) — Slack integration reference
- [docs/SECURITY_KEY_ROTATION.md](./docs/SECURITY_KEY_ROTATION.md) — credential rotation
- [GitHub Issues](https://github.com/southleft/company-docs-mcp/issues) — report bugs or request features
