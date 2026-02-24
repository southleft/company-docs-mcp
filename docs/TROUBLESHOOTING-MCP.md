# Troubleshooting Remote MCP Connection

## Issue: MCP Not Appearing in Your Client

If your Company Docs MCP isn't showing up in your MCP client, follow these steps:

### Understanding MCP Connections

MCP (Model Context Protocol) clients connect to remote servers over HTTPS. Most clients support adding a remote MCP server URL directly in their settings. Some older clients may require a local bridge process like `mcp-remote`.

### 1. Verify Worker is Deployed

First, ensure your worker is deployed and accessible:

```bash
# Deploy the worker
npm run deploy

# Note the URL from the output, it will look like:
# https://company-docs-mcp.your-subdomain.workers.dev

# Test the MCP endpoint
curl -X POST https://company-docs-mcp.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1.0.0","capabilities":{}}}'
```

You should see a JSON response with server information.

### 2. Connect Your MCP Client

Add this URL to your MCP client:

```
https://company-docs-mcp.<your-subdomain>.workers.dev/mcp
```

**Claude:** Settings > Connectors > Add custom connector > paste the URL.

**Cursor:** Settings > MCP > Add new MCP server > enter the URL.

**Windsurf / Other clients:** Refer to your client's documentation for adding a remote MCP server.

### Alternative: Using mcp-remote (Older Clients)

If your client only supports stdio-based MCP servers, use a local bridge:

```json
{
  "mcpServers": {
    "Company Docs": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://company-docs-mcp.<your-subdomain>.workers.dev/mcp"
      ]
    }
  }
}
```

### 3. Test Your Configuration

Test the MCP endpoint directly before configuring your client:

```bash
# Test with curl
curl -X POST https://company-docs-mcp.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Test with mcp-remote
npx mcp-remote@latest https://company-docs-mcp.your-subdomain.workers.dev/mcp
# Press Ctrl+C to exit after confirming connection
```

### 4. Restart Your Client

After updating the configuration:

1. **Completely quit your MCP client** (not just close the window)
2. **Restart it**
3. **Start a new conversation**
4. **Look for "Company Docs" in available tools/MCPs**

### 5. Verify Tools Are Available

You should see these tools:

- `search_documentation`
- `search_chunks`
- `browse_by_category`
- `get_all_tags`

### 6. Common Issues and Solutions

**Issue: "Unknown MCP" or MCP not listed**
- Verify the URL ends with `/mcp`
- If using mcp-remote, ensure `"command"` and `"args"` are used (not `"url"`)

**Issue: MCP appears but tools don't work**
- Check worker logs: `npx wrangler tail`
- Verify Supabase credentials are set as Worker secrets
- Ensure content has been ingested to Supabase

**Issue: Connection timeout**
- If using mcp-remote, it may take a moment to download on first run
- Try running the npx command manually first to cache it

### 7. Debug with Logs

Check worker logs:
```bash
npx wrangler tail
```

### Important Notes

- The remote server must be accessible via HTTPS
- The `/mcp` endpoint handles MCP Streamable HTTP protocol
- Any MCP-compatible client can connect — this is not limited to any specific tool

### Need More Help?

If you're still having issues:

1. Verify the server responds: Test with curl commands above
2. Check worker logs: `npx wrangler tail`
3. Review the [Deployment Guide](./DEPLOYMENT.md)
4. Check [GitHub Issues](https://github.com/southleft/company-docs-mcp/issues)
