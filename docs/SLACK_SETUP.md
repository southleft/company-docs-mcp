# Slack Bot Setup Guide

## Overview
The company-docs-mcp includes Slack integration to search documentation directly from Slack using slash commands.

## Setup Instructions

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Name your app (e.g., "CanvasKit Docs")
5. Select your workspace

### 2. Configure Slash Commands

1. In your app settings, go to "Slash Commands"
2. Click "Create New Command"
3. Configure the command:
   - **Command**: `/docs`
   - **Request URL**: 
     - For local testing: Use ngrok (see below)
     - For production: `https://your-worker-name.workers.dev/slack`
   - **Short Description**: Search CanvasKit documentation
   - **Usage Hint**: [search term]

### 3. Configure OAuth & Permissions

1. Go to "OAuth & Permissions"
2. Add these Bot Token Scopes:
   - `commands` - To receive slash commands
   - `chat:write` - To post messages
   - `chat:write.public` - To post in public channels

3. Install the app to your workspace
4. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 4. Get Your App Credentials

From your Slack app settings, collect:
- **Bot Token**: OAuth & Permissions → Bot User OAuth Token
- **Signing Secret**: Basic Information → Signing Secret
- **App Token** (if using Socket Mode): Basic Information → App-Level Tokens

### 5. Update Your .env File

Your .env file already has these configured:
```env
SLACK_BOT_TOKEN="xoxb-..."
SLACK_SIGNING_SECRET="..."
SLACK_SLASH_COMMAND="/docs"
ENABLE_SLACK_BOT=true
```

## Testing Locally

### Option 1: Using ngrok (Recommended)

1. Install ngrok:
   ```bash
   brew install ngrok
   ```

2. Start your local server:
   ```bash
   npm run dev
   ```

3. In another terminal, expose your local server:
   ```bash
   ngrok http 8787
   ```

4. Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`)

5. Update your Slack app's slash command URL:
   - Go to your Slack app settings → Slash Commands
   - Edit your command
   - Update Request URL to: `https://abc123.ngrok.io/slack`
   - Save

6. Test in Slack:
   ```
   /docs breakpoints
   /docs typography spacing
   /docs switches
   ```

### Option 2: Using Cloudflare Tunnel

1. Install Cloudflare tunnel:
   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. Start your local server:
   ```bash
   npm run dev
   ```

3. Create a tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:8787
   ```

4. Use the provided URL in your Slack app configuration

## Testing the Integration

### In Slack:

1. **Basic search**:
   ```
   /docs breakpoints
   ```

2. **Multi-word search**:
   ```
   /docs typography and spacing
   ```

3. **Help command** (empty query):
   ```
   /docs
   ```

### Expected Behavior:

- The bot will immediately acknowledge your command
- Within 1-2 seconds, it will update with search results
- Results show the top 3 most relevant documentation chunks
- Each result includes a title and excerpt
- Source links are provided when available

## Deploying to Production

1. **Deploy your Worker**:
   ```bash
   npm run deploy
   ```

2. **Update Slack App**:
   - Change the Request URL to: `https://sl-company-docs-mcp.workers.dev/slack`
   - Save changes

3. **Verify Webhook**:
   - Slack will send a verification request
   - Your Worker will respond automatically

## Troubleshooting

### Common Issues:

1. **"Invalid command" error**:
   - Check that SLACK_SLASH_COMMAND in .env matches your Slack app configuration

2. **"Unauthorized" error**:
   - Verify SLACK_SIGNING_SECRET is correct
   - Check that the request is coming from Slack

3. **No results found**:
   - Ensure content is loaded (check server logs)
   - Try different search terms

4. **Timeout errors**:
   - Slack requires responses within 3 seconds
   - The Worker uses deferred responses to handle this

### Debug Mode:

Check server logs:
```bash
tail -f /tmp/mcp.log
```

### Testing with curl:

```bash
curl -X POST http://localhost:8787/slack \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Slack-Signature: test" \
  -H "X-Slack-Request-Timestamp: test" \
  -d "command=/docs&text=breakpoints&response_url=http://localhost:3000/test"
```

## Security Considerations

1. **Never commit tokens**: Keep your .env file in .gitignore
2. **Verify signatures**: The Worker verifies all requests are from Slack
3. **Use HTTPS**: Always use HTTPS URLs in production
4. **Rotate tokens**: Regularly rotate your Slack tokens

## Advanced Features

### Customizing Responses

Edit `src/slack-webhook.ts` to customize:
- Number of results shown
- Response formatting
- Error messages
- Help text

### Adding Interactive Features

Future enhancements could include:
- Interactive buttons for pagination
- Dropdown menus for filtering
- Modal dialogs for detailed views

## Support

If you encounter issues:
1. Check the logs: `tail -f /tmp/mcp.log`
2. Verify all environment variables are set
3. Ensure the Worker is running: `npm run dev`
4. Test the health endpoint: `curl http://localhost:8787/health`
