# Troubleshooting Remote MCP Connection

## Issue: MCP Not Appearing in Claude Desktop

If your Company Docs MCP isn't showing up in Claude Desktop, follow these steps:

### Understanding the Problem
Claude Desktop does NOT support remote MCP servers directly via a `"url"` property. It only supports local processes that it can start via `"command"` and `"args"`. To connect to a remote MCP server, you need a local bridge/proxy process.

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

### 2. Choose a Connection Method

#### Method A: Using mcp-remote Package (Simplest)
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

#### Method B: Using Standalone Client (Most Reliable)
1. Ensure you have the `standalone-mcp-client.cjs` file
2. Add to config:
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

#### Method C: Using Full Node Path (If Node Not in PATH)
```json
{
  "mcpServers": {
    "Company Docs": {
      "command": "/usr/local/bin/node",
      "args": [
        "/absolute/path/to/standalone-mcp-client.cjs"
      ]
    }
  }
}
```

### 3. Configuration File Location

Make sure you're editing the correct file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 4. Test Your Configuration

Before adding to Claude Desktop, test your setup:

#### Test mcp-remote:
```bash
npx mcp-remote@latest https://company-docs-mcp.your-subdomain.workers.dev/mcp
# Press Ctrl+C to exit after confirming connection
```

#### Test standalone client:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  node /path/to/standalone-mcp-client.cjs
```

### 5. Restart Claude Desktop

After updating the configuration:

1. **Completely quit Claude Desktop** (not just close the window)
   - macOS: Cmd+Q or right-click dock icon → Quit
   - Windows: Right-click system tray icon → Exit
2. **Restart Claude Desktop**
3. **Start a new conversation**
4. **Look for "Company Docs" in available MCPs**

### 6. Verify in Claude Desktop

1. Start a new conversation
2. You should see tools like:
   - `search_design_knowledge`
   - `search_chunks`
   - `browse_by_category`
   - `get_all_tags`

### 7. Common Issues and Solutions

**Issue: "Unknown MCP" or MCP not listed**
- Solution: You're likely using `"url"` instead of `"command"`. Use one of the methods above.

**Issue: "Command not found" error**
- Solution: Use full path to node executable (e.g., `/usr/local/bin/node`)

**Issue: MCP appears but tools don't work**
- Check worker logs: `npx wrangler tail`
- Verify Supabase credentials are set in wrangler.toml
- Ensure content has been ingested to Supabase

**Issue: Connection timeout**
- The mcp-remote package may take a moment to download on first run
- Try running the npx command manually first to cache it

### 8. Debug with Logs

Check worker logs:
```bash
npx wrangler tail
```

Test the connection manually:
```bash
# Test with mcp-remote
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | \
  npx mcp-remote@latest https://company-docs-mcp.your-subdomain.workers.dev/mcp

# Test with standalone client
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | \
  node standalone-mcp-client.cjs
```

### Important Notes

- **DO NOT** use `"url"` property - Claude Desktop doesn't support it
- **ALWAYS** use `"command"` and `"args"` format
- The remote server must be accessible via HTTPS
- The `/mcp` endpoint must handle MCP JSON-RPC protocol

### Need More Help?

If you're still having issues:

1. Verify the server responds: Test with curl commands above
2. Check that Node.js is installed: `node --version`
3. Try the standalone client method as it's most reliable
4. Check [GitHub Issues](https://github.com/your-org/company-docs-mcp/issues)
