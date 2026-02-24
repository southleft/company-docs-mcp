# Slack Integration Setup

## Overview

company-docs-mcp includes a Slack slash command integration that lets your team search ingested documentation directly from any Slack channel. The integration runs as a Cloudflare Worker webhook -- no persistent bot process, no Socket Mode, no bot token required.

**How it works:**

1. A user types `/docs deployment process` in Slack.
2. Slack sends a POST request to your Cloudflare Worker at the `/slack` endpoint.
3. The Worker searches your Supabase vector store, synthesizes a response using AI, and posts the result back to the channel.

**AI response strategy:** The handler uses a three-tier approach to generate answers. It first attempts synthesis via OpenAI (if an API key is configured), falls back to Cloudflare Workers AI (built into the Workers runtime), and as a final fallback returns well-formatted raw documentation content. This ensures users always get a useful response regardless of which AI services are available.

## Prerequisites

- A deployed Cloudflare Worker (`npm run deploy`)
- Ingested documentation in your Supabase vector store
- A Slack workspace where you can install apps

## Environment Variables

The Slack integration requires only one secret:

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_SIGNING_SECRET` | Yes | Verifies that incoming requests originate from Slack. Found in your Slack app under Basic Information. |
| `SLACK_SLASH_COMMAND` | No | The slash command name. Defaults to `/docs`. |

Set the signing secret as a Cloudflare Worker secret:

```bash
npx wrangler secret put SLACK_SIGNING_SECRET
```

If you use a custom command name, add `SLACK_SLASH_COMMAND` to your `wrangler.toml` under `[vars]`:

```toml
[vars]
SLACK_SLASH_COMMAND = "/kb"
```

## Setup Instructions

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps).
2. Click "Create New App" and choose "From scratch".
3. Name your app (e.g., "Docs Search") and select your workspace.

### 2. Configure the Slash Command

1. In your app settings, navigate to **Slash Commands**.
2. Click **Create New Command** and fill in the fields:
   - **Command:** `/docs` (or your preferred command name)
   - **Request URL:** `https://company-docs-mcp.<your-subdomain>.workers.dev/slack`
   - **Short Description:** Search documentation
   - **Usage Hint:** `[search query]`

### 3. Configure OAuth and Permissions

1. Go to **OAuth & Permissions**.
2. Under **Bot Token Scopes**, add:
   - `commands` -- required to receive slash commands
3. Install the app to your workspace.

### 4. Copy the Signing Secret

1. Go to **Basic Information** in your Slack app settings.
2. Under **App Credentials**, copy the **Signing Secret**.
3. Set it as a Cloudflare secret (see Environment Variables above).

## Testing Locally

### Option 1: Using ngrok

1. Install ngrok:
   ```bash
   brew install ngrok
   ```

2. Start your local Worker:
   ```bash
   npm run dev
   ```

3. In a second terminal, expose port 8787:
   ```bash
   ngrok http 8787
   ```

4. Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`).

5. Update your Slack app's slash command Request URL to:
   ```
   https://abc123.ngrok.io/slack
   ```

6. Test in Slack:
   ```
   /docs deployment process
   /docs API authentication
   /docs getting started
   ```

### Option 2: Using Cloudflare Tunnel

1. Install cloudflared:
   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. Start your local Worker:
   ```bash
   npm run dev
   ```

3. Create a tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:8787
   ```

4. Use the tunnel URL as your slash command Request URL (append `/slack`).

## Testing the Integration

### Basic Searches

1. **Single-term search:**
   ```
   /docs deployment process
   ```

2. **Multi-word search:**
   ```
   /docs API authentication flow
   ```

3. **Help (empty query):**
   ```
   /docs
   ```

### Expected Behavior

- The slash command immediately acknowledges with "Searching for..." in the channel.
- Within a few seconds, the Worker posts an AI-synthesized answer drawn from your ingested documentation.
- The response includes a header with your organization name, the synthesized answer formatted for Slack, and a sources list linking back to the original documents.
- If no matching documentation is found, the user sees a message suggesting different search terms.

## Deploying to Production

1. **Deploy the Worker:**
   ```bash
   npm run deploy
   ```

2. **Set the signing secret** (if not already configured):
   ```bash
   npx wrangler secret put SLACK_SIGNING_SECRET
   ```

3. **Update the Slack app:**
   - Change the slash command Request URL to your production Worker URL:
     ```
     https://company-docs-mcp.<your-subdomain>.workers.dev/slack
     ```
   - Save changes.

4. **Verify the webhook:**
   - Slack will send a verification request to your Worker.
   - The Worker responds automatically.

## Troubleshooting

### Common Issues

1. **"Invalid command" error:**
   - Confirm that `SLACK_SLASH_COMMAND` matches the command configured in your Slack app. If you did not set `SLACK_SLASH_COMMAND`, the default is `/docs`.

2. **"Unauthorized" error:**
   - Verify that `SLACK_SIGNING_SECRET` is set correctly as a Cloudflare secret.
   - Confirm the request is reaching your Worker (check logs).

3. **No results found:**
   - Make sure you have ingested content into Supabase.
   - Try broader or different search terms.

4. **Timeout errors:**
   - Slack requires an initial response within 3 seconds. The Worker sends an immediate acknowledgment and then posts the full answer asynchronously via the `response_url`, so timeouts here are rare. If the follow-up response is slow, check your OpenAI and Supabase latency.

### Viewing Logs

Stream real-time logs from your deployed Worker:

```bash
npx wrangler tail
```

For local development, logs print directly to the terminal running `npm run dev`.

### Testing with curl

```bash
curl -X POST http://localhost:8787/slack \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Slack-Signature: test" \
  -H "X-Slack-Request-Timestamp: $(date +%s)" \
  -d "command=/docs&text=API+authentication&response_url=https://httpbin.org/post"
```

Note: In production, the Worker verifies the `X-Slack-Signature` header using HMAC-SHA256 with your signing secret. The curl example above bypasses this for local testing only.

## Security Considerations

1. **Keep secrets out of version control.** Never commit `SLACK_SIGNING_SECRET` or other credentials. Use `wrangler secret put` for production and `.dev.vars` for local development.
2. **Signature verification.** The Worker validates every incoming request using the Slack signing secret to confirm it originated from Slack.
3. **HTTPS only.** Cloudflare Workers are served over HTTPS by default. Ensure any local tunneling tool (ngrok, cloudflared) also uses HTTPS.

## Customizing Responses

Edit `src/slack-webhook.ts` to adjust:

- The number of search results included in the AI prompt
- Response formatting and Slack block structure
- The AI system prompt and synthesis behavior
- Error messages and help text
- The organization name displayed in the header (set `ORGANIZATION_NAME` in your Worker vars)

## Support

If you encounter issues:

1. Check Worker logs with `npx wrangler tail`.
2. Verify that `SLACK_SIGNING_SECRET` is set: `npx wrangler secret list`.
3. Confirm the Worker is running: `curl https://company-docs-mcp.<your-subdomain>.workers.dev/health`.
4. Open an issue on the [GitHub repository](https://github.com/AcuteClick/company-docs-mcp/issues).
