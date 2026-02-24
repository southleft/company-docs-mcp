# Deployment Guide

This guide covers deploying the Company Docs MCP server to Cloudflare Workers, the only supported deployment target.

The MCP server runs as a Cloudflare Worker that handles search queries, MCP protocol requests, Slack slash commands, and a built-in chat UI. It connects to Supabase for vector search and uses Cloudflare Workers AI for embeddings. OpenAI is optional — only needed if you prefer OpenAI embeddings or want the AI-powered chat feature.

## Prerequisites

- **Cloudflare account** -- free tier works ([dash.cloudflare.com](https://dash.cloudflare.com))
- **Wrangler CLI** -- installed globally or used via `npx`
- **Supabase project** -- with the schema from `database/schema.sql` applied (see the [README](../README.md) for setup)
- **OpenAI API key** (optional) -- only needed if using OpenAI embeddings or the AI chat feature; Workers AI is used by default
- **Node.js 18+** -- for local development and the Wrangler CLI

Authenticate Wrangler before proceeding:

```bash
npx wrangler login
```

## Step 1: Clone the Repository

```bash
git clone https://github.com/southleft/company-docs-mcp.git
cd company-docs-mcp
npm install
```

## Step 2: Configure wrangler.toml

Create or edit `wrangler.toml` in the project root:

```toml
name = "company-docs-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Workers AI binding — provides free embedding generation at query time (no API key needed)
[ai]
binding = "AI"

# Non-sensitive configuration only -- never put API keys or credentials here
[vars]
ORGANIZATION_NAME = "Your Organization"
ORGANIZATION_DOMAIN = "example.com"
ORGANIZATION_LOGO_URL = ""
ORGANIZATION_TAGLINE = "Get instant answers from your documentation."
VECTOR_SEARCH_ENABLED = "true"
VECTOR_SEARCH_MODE = "vector"

# KV namespace for caching search results
[[kv_namespaces]]
binding = "CONTENT_CACHE"
id = "<your-kv-namespace-id>"
```

**Important**: Do not put sensitive values like API keys, Supabase URLs, or service keys in `[vars]`. Those are set as encrypted secrets in Step 4.

## Step 3: Create the KV Namespace

The Worker uses a KV namespace to cache search results for 5 minutes, reducing repeated calls to Supabase.

```bash
npx wrangler kv namespace create CONTENT_CACHE
```

Wrangler will output something like:

```
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CONTENT_CACHE", id = "abc123def456..." }
```

Copy the `id` value into the `[[kv_namespaces]]` section of your `wrangler.toml`.

## Step 4: Set Secrets

Secrets are encrypted and only available to your Worker at runtime. They never appear in `wrangler.toml` or in the Cloudflare dashboard in plain text.

**Required secrets:**

```bash
echo "https://your-project.supabase.co" | npx wrangler secret put SUPABASE_URL
echo "your-service-role-key" | npx wrangler secret put SUPABASE_SERVICE_KEY
echo "your-anon-key" | npx wrangler secret put SUPABASE_ANON_KEY
```

**Optional secrets:**

```bash
# Only needed if using OpenAI embeddings instead of Workers AI, or for AI chat
echo "sk-your-openai-api-key" | npx wrangler secret put OPENAI_API_KEY

# Only needed if you use Slack integration
echo "your-slack-signing-secret" | npx wrangler secret put SLACK_SIGNING_SECRET

# Override the default OpenAI model (defaults to gpt-4o)
echo "gpt-4o-mini" | npx wrangler secret put OPENAI_MODEL
```

The Worker uses its built-in Workers AI binding (`[ai]` in `wrangler.toml`) for embeddings by default. No additional API key is needed — the binding provides direct in-network access to Cloudflare's AI models at zero cost.

You can also set secrets interactively (Wrangler will prompt for the value):

```bash
npx wrangler secret put OPENAI_API_KEY
```

## Step 5: Deploy

```bash
npm run deploy
```

This runs `wrangler deploy`, which compiles the TypeScript source and publishes the Worker.

On success, Wrangler prints the URL where your Worker is live:

```
Published company-docs-mcp (X.XXs)
  https://company-docs-mcp.<your-subdomain>.workers.dev
```

## Step 6: Verify

Replace `<your-subdomain>` with your actual Cloudflare Workers subdomain in the commands below.

**Health check:**

```bash
curl https://company-docs-mcp.<your-subdomain>.workers.dev/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "Your Organization MCP",
  "version": "2.0.0"
}
```

If any required environment variables are missing, the response includes a `warnings` array describing what is not configured.

**Search test:**

```bash
curl -X POST https://company-docs-mcp.<your-subdomain>.workers.dev/search \
  -H "Content-Type: application/json" \
  -d '{"query": "getting started", "limit": 3}'
```

**MCP endpoint:**

The MCP protocol endpoint is available at `/mcp`. This is the URL you provide when connecting any MCP client:

```
https://company-docs-mcp.<your-subdomain>.workers.dev/mcp
```

**Chat UI:**

Visit the root URL in a browser to access the built-in chat interface:

```
https://company-docs-mcp.<your-subdomain>.workers.dev/
```

## Environment Variables Reference

### Non-Sensitive (set in `[vars]` in wrangler.toml)

| Variable | Description | Default |
|----------|-------------|---------|
| `ORGANIZATION_NAME` | Displayed in the chat UI and health check | `"Organization"` |
| `ORGANIZATION_DOMAIN` | Your organization's domain | `"example.com"` |
| `ORGANIZATION_LOGO_URL` | URL to a logo image for the chat UI | (none) |
| `ORGANIZATION_TAGLINE` | Tagline shown in the chat UI | `"Get instant answers from your documentation."` |
| `ORGANIZATION_SUBTITLE` | Subtitle shown in the chat UI | `"Powered by MCP (Model Context Protocol)"` |
| `EMBEDDING_PROVIDER` | Embedding backend: `"workers-ai"` or `"openai"` | Auto-detected |
| `VECTOR_SEARCH_ENABLED` | Enable vector search via Supabase | `"true"` |
| `VECTOR_SEARCH_MODE` | Search mode (`"vector"`, `"local"`, or `"hybrid"`) | `"vector"` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated or `*`) | `"*"` |
| `SLACK_SLASH_COMMAND` | Custom Slack slash command name | `"/docs"` |
| `AI_SYSTEM_PROMPT` | Custom system prompt for AI chat responses | (built-in default) |

### Sensitive (set as secrets via `wrangler secret put`)

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (full access) | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon key (respects RLS) | Yes |
| `OPENAI_API_KEY` | OpenAI API key — only needed for the AI chat feature; search, MCP, and Slack work without it | No |
| `OPENAI_MODEL` | OpenAI chat model for AI chat responses | No (defaults to `gpt-4o`) |
| `SLACK_SIGNING_SECRET` | Slack app signing secret for webhook verification | No |

### Bindings (configured in wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `CONTENT_CACHE` | KV Namespace | Caches search results (5 min TTL) |
| `AI` | Workers AI | Default embedding provider and chat fallback |

## Monitoring

### Cloudflare Dashboard

The Cloudflare dashboard provides built-in analytics for your Worker:

- **Requests** -- total requests, success rate, error rate
- **CPU time** -- execution time per invocation
- **Errors** -- 4xx/5xx breakdown with timestamps

Navigate to **Workers & Pages** in the Cloudflare dashboard, select your Worker, and open the **Metrics** tab.

### Live Logs with wrangler tail

Stream real-time logs from your deployed Worker to your terminal:

```bash
npx wrangler tail
```

This shows every `console.log`, `console.error`, and `console.warn` call from the Worker, along with request metadata (method, URL, status code, duration).

Filter to errors only:

```bash
npx wrangler tail --format pretty --status error
```

Filter by search path:

```bash
npx wrangler tail --search "/search"
```

Press `Ctrl+C` to stop tailing.

### Health Endpoint

The `/health` endpoint serves as a lightweight monitoring target. Point your uptime monitor (Uptime Robot, Better Stack, Cloudflare Health Checks, etc.) at:

```
https://company-docs-mcp.<your-subdomain>.workers.dev/health
```

A `200` response with `"status": "ok"` indicates the Worker is running. Any `warnings` in the response indicate missing configuration that may affect functionality.

## Updating

To deploy changes after updating the code or configuration:

```bash
git pull
npm install
npm run deploy
```

To update secrets:

```bash
echo "new-value" | npx wrangler secret put SECRET_NAME
```

Secret changes take effect immediately without redeploying the Worker code.

## Troubleshooting

### Worker not responding

- Check the Cloudflare dashboard for error logs under **Workers & Pages > your Worker > Logs**
- Run `npx wrangler tail` to see real-time errors
- Verify the Worker is deployed: `npx wrangler deployments list`

### Health check shows warnings

- `SUPABASE_URL/SUPABASE_ANON_KEY not set` -- run the `wrangler secret put` commands from Step 4
- `No embedding provider available` -- ensure the `[ai]` binding is present in `wrangler.toml`
- `OPENAI_API_KEY not set` -- this is informational only; vector search uses Workers AI by default and works without OpenAI

### Search returning no results

- Confirm content has been ingested: `npx company-docs publish --dry-run`
- Verify the Supabase URL and keys are correct
- Check that `VECTOR_SEARCH_ENABLED` is set to `"true"` in `[vars]`
- Run `npx wrangler tail` and perform a search to see any runtime errors

### KV cache issues

- Verify the KV namespace ID in `wrangler.toml` matches the one created in Step 3
- List your KV namespaces: `npx wrangler kv namespace list`
- Cache entries expire after 5 minutes automatically; no manual clearing needed

### Slack integration not working

- Verify `SLACK_SIGNING_SECRET` is set as a secret
- Confirm the Slack app's request URL points to `https://company-docs-mcp.<your-subdomain>.workers.dev/slack`
- See [SLACK_SETUP.md](SLACK_SETUP.md) for full Slack configuration

### Deployment fails

- Run `npx wrangler whoami` to confirm you are authenticated
- Check that `compatibility_flags` includes `"nodejs_compat"` (not the deprecated `node_compat = true`)
- Ensure the `[ai]` binding is present for Workers AI embeddings
- Verify the KV namespace ID is valid

## Support

For deployment issues:

1. Check the troubleshooting section above
2. Run `npx wrangler tail` to inspect runtime errors
3. Open an issue at [github.com/southleft/company-docs-mcp](https://github.com/southleft/company-docs-mcp/issues)
