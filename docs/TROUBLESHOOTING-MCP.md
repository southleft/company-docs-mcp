# Troubleshooting Remote MCP Connection

## Issue: MCP Not Appearing in Claude Desktop

If your Company Docs MCP isn't showing up in Claude Desktop when using remote URL configuration, follow these steps:

### 1. Verify Worker is Deployed

First, ensure your worker is deployed and accessible:

```bash
# Deploy the worker
npm run deploy

# Note the URL from the output, it will look like:
# https://company-docs-mcp.your-subdomain.workers.dev

# Test the health endpoint
curl https://company-docs-mcp.your-subdomain.workers.dev/health
```

### 2. Test MCP Endpoint

Test that the MCP endpoint responds correctly with SSE format:

```bash
curl -X POST https://company-docs-mcp.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0.0","capabilities":{}}}' \
  -s
```

You should see a response starting with `event: message` followed by JSON data.

### 3. Correct Claude Desktop Configuration

The configuration format for remote MCP servers is different from local ones. Here's the correct format:

**For Remote MCP (Cloudflare Workers):**
```json
{
  "mcpServers": {
    "company-docs": {
      "url": "https://company-docs-mcp.your-subdomain.workers.dev/mcp"
    }
  }
}
```

**Important:** 
- Use `"url"` not `"command"` for remote servers
- The URL must end with `/mcp`
- Don't include environment variables in the remote configuration

**For Local MCP (if running locally):**
```json
{
  "mcpServers": {
    "company-docs": {
      "command": "node",
      "args": ["/absolute/path/to/company-docs-mcp/dist/index.js"],
      "env": {
        "SUPABASE_URL": "your-supabase-url",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

### 4. Configuration File Location

Make sure you're editing the correct file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 5. Restart Claude Desktop

After updating the configuration:

1. Completely quit Claude Desktop (not just close the window)
2. Restart Claude Desktop
3. Check if "company-docs" appears in the available MCPs

### 6. Verify in Claude Desktop

1. Start a new conversation
2. Look for the MCP tools indicator
3. You should see tools like:
   - `search_docs`
   - `search_by_category`
   - `get_categories`
   - `search_by_tags`
   - `get_all_tags`

### 7. Common Issues

**Issue: "Unknown MCP" or MCP not listed**
- Ensure the worker URL is correct and accessible
- Verify the URL ends with `/mcp`
- Check that you're using `"url"` not `"command"` for remote servers

**Issue: MCP appears but tools don't work**
- Check that your worker has the correct environment variables set
- Verify Supabase credentials are valid
- Ensure content has been ingested to Supabase

**Issue: CORS errors**
- The worker includes CORS headers, but ensure no proxy is blocking them
- Try accessing the URL directly in a browser

### 8. Debug with Logs

Check worker logs:
```bash
npx wrangler tail
```

Then try to connect from Claude Desktop and watch for any errors.

### Need More Help?

If you're still having issues:

1. Check the [GitHub Issues](https://github.com/your-org/company-docs-mcp/issues)
2. Ensure you've followed the [QUICKSTART guide](../QUICKSTART.md)
3. Verify all environment variables are set correctly in `wrangler.toml`
