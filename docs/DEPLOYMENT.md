# Deployment Guide

This guide covers different deployment options for your Company Docs MCP server.

## Deployment Options

1. **Local Development** - Run on your machine for testing
2. **Cloudflare Workers** - Serverless deployment (recommended)
3. **Docker** - Self-hosted container deployment
4. **Traditional Server** - Deploy to VPS or cloud VM

## Cloudflare Workers Deployment (Recommended)

### Prerequisites
- Cloudflare account (free tier works)
- Wrangler CLI installed: `npm install -g wrangler`

### Step 1: Configure Wrangler

Edit `wrangler.toml` with your settings:

```toml
name = "company-docs-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

[vars]
ORGANIZATION_NAME = "Your Company"
SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_ANON_KEY = "your-anon-key"

[[kv_namespaces]]
binding = "CONTENT_CACHE"
id = "your-kv-namespace-id"
```

### Step 2: Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create CONTENT_CACHE

# Note the ID returned and add it to wrangler.toml
```

### Step 3: Add Secrets

```bash
# Add sensitive keys as secrets (not in wrangler.toml)
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
```

### Step 4: Deploy

```bash
# Deploy to production
npm run deploy

# Your MCP will be available at:
# https://company-docs-mcp.<your-subdomain>.workers.dev
```

### Step 5: Verify Deployment

```bash
# Test the MCP endpoint
curl https://company-docs-mcp.workers.dev/health

# Test search functionality
curl -X POST https://company-docs-mcp.workers.dev/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication"}'
```

## Docker Deployment

### Step 1: Create Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Step 2: Build and Run

```bash
# Build image
docker build -t company-docs-mcp .

# Run container
docker run -d \
  --name docs-mcp \
  -p 3000:3000 \
  --env-file .env \
  company-docs-mcp
```

### Step 3: Docker Compose (Optional)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mcp:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
    
  slack-bot:
    build: .
    command: npm run slack:start
    env_file:
      - .env
    depends_on:
      - mcp
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Traditional Server Deployment

### Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'company-docs-mcp',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'docs-slack-bot',
      script: 'dist/slack-bot/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
```

### Using systemd

Create `/etc/systemd/system/company-docs-mcp.service`:

```ini
[Unit]
Description=Company Docs MCP Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/company-docs-mcp
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable company-docs-mcp
sudo systemctl start company-docs-mcp
```

## Environment-Specific Configuration

### Production Best Practices

1. **Use environment variables for secrets**
   ```bash
   # Never commit .env files
   # Use platform-specific secret management
   ```

2. **Enable CORS appropriately**
   ```typescript
   const corsOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
   ```

3. **Implement rate limiting**
   ```typescript
   const rateLimit = {
     windowMs: 60 * 1000, // 1 minute
     max: 100 // limit each IP to 100 requests per minute
   };
   ```

4. **Add monitoring**
   - Use Cloudflare Analytics for Workers
   - Add custom metrics to your application
   - Set up alerts for errors

### Security Considerations

1. **API Authentication**
   ```typescript
   // Add API key validation
   if (request.headers.get('X-API-Key') !== process.env.API_KEY) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

2. **Input Validation**
   ```typescript
   // Sanitize user queries
   const sanitizedQuery = query.replace(/[^\w\s-]/g, '');
   ```

3. **Secure Headers**
   ```typescript
   response.headers.set('X-Content-Type-Options', 'nosniff');
   response.headers.set('X-Frame-Options', 'DENY');
   response.headers.set('X-XSS-Protection', '1; mode=block');
   ```

## Monitoring & Maintenance

### Health Checks

Add a health endpoint:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### Logging

Configure structured logging:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Backup Strategy

1. **Database Backups**
   - Use Supabase's built-in backup features
   - Schedule regular exports of your content

2. **Configuration Backups**
   - Version control your configuration files
   - Document all environment variables

## Troubleshooting

### Common Issues

**Worker not responding**
- Check Cloudflare dashboard for errors
- Verify environment variables are set
- Check KV namespace bindings

**Slack bot not connecting**
- Verify bot tokens are correct
- Check Socket Mode is enabled
- Review Slack app permissions

**Search returning no results**
- Ensure content is ingested
- Verify embeddings are generated
- Check Supabase connection

### Debug Mode

Enable debug logging:

```bash
# Set in .env or environment
DEBUG_MODE=true
LOG_LEVEL=debug
```

## Performance Optimization

### Caching Strategy

1. **KV Cache for Cloudflare**
   ```typescript
   const cached = await env.CONTENT_CACHE.get(cacheKey);
   if (cached) return JSON.parse(cached);
   ```

2. **In-Memory Cache**
   ```typescript
   const cache = new Map();
   const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
   ```

### Database Optimization

1. **Indexes**
   ```sql
   CREATE INDEX idx_content_search ON content_entries 
   USING gin(search_text);
   ```

2. **Connection Pooling**
   ```typescript
   const pool = new Pool({
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000
   });
   ```

## Support

For deployment issues:
1. Check the [troubleshooting guide](#troubleshooting)
2. Review logs for error messages
3. Open an issue on GitHub
4. Contact support (if applicable)