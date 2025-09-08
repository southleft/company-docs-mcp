#!/usr/bin/env node

/**
 * Standalone MCP Client for Company Docs
 * Version: 1.0.0
 * 
 * This single file connects Claude Desktop to the remote Company Docs MCP server.
 * No repository needed - just this file!
 * 
 * INSTALLATION:
 * 1. Download this file to your computer
 * 2. Update the MCP_SERVER_URL below to point to your deployed server
 * 3. Note the full path where you saved this file
 * 4. Add to Claude Desktop config - see instructions below
 * 
 * CLAUDE DESKTOP CONFIGURATION:
 * Edit: ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
 *       %APPDATA%\Claude\claude_desktop_config.json (Windows)
 *       ~/.config/Claude/claude_desktop_config.json (Linux)
 * 
 * Add this to your mcpServers section:
 * {
 *   "mcpServers": {
 *     "Company Docs": {
 *       "command": "node",
 *       "args": ["/full/path/to/standalone-mcp-client.cjs"]
 *     }
 *   }
 * }
 */

const https = require('https');
const readline = require('readline');

// ========== CONFIGURATION ==========
// IMPORTANT: Change this URL to your deployed Cloudflare Workers URL
// Get this from running 'npm run deploy' in your company-docs-mcp project
const MCP_SERVER_URL = 'https://company-docs-mcp.your-subdomain.workers.dev/mcp';
// ===================================

// Setup readline for STDIO communication with Claude Desktop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Handle incoming requests from Claude Desktop
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const response = await forwardToRemoteServer(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: `Client error: ${error.message}`
      }
    }));
  }
});

// Forward requests to remote MCP server
function forwardToRemoteServer(request) {
  return new Promise((resolve, reject) => {
    const url = new URL(MCP_SERVER_URL);
    const postData = JSON.stringify(request);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json'
      },
      timeout: 30000
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          // Try parsing as JSON
          const jsonResponse = JSON.parse(responseData);
          resolve(jsonResponse);
        } catch (e) {
          // If it's SSE format, extract the JSON from it
          const sseMatch = responseData.match(/data:\s*(.+)/);
          if (sseMatch && sseMatch[1]) {
            try {
              resolve(JSON.parse(sseMatch[1]));
            } catch (e2) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error('Could not parse response'));
          }
        }
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`Connection failed: ${e.message}`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout (30s)'));
    });
    
    req.write(postData);
    req.end();
  });
}

// Log to stderr so it doesn't interfere with STDIO protocol
process.stderr.write(`MCP Client connected to: ${MCP_SERVER_URL}\n`);

// Handle graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));