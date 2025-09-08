# Local Development Setup

This guide explains how to set up a local development environment for testing with your organization's specific documentation while keeping the public repository design-system agnostic.

## Overview

The repository supports a dual-environment configuration:
- **Production/Public**: Generic, design-system agnostic configuration
- **Local/Testing**: Organization-specific configuration for development and testing

## Setup Instructions

### 1. Create Local Configuration Files

Create two local configuration files that will be ignored by git:

#### `.env.local`
Copy `.env.example` to `.env.local` and add your organization-specific values:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your organization's details:
- `ORGANIZATION_NAME`: Your organization/design system name
- `ORGANIZATION_DOMAIN`: Your domain
- `ORGANIZATION_LOGO_URL`: URL to your logo
- `ORGANIZATION_TAGLINE`: Your specific tagline
- Add your real API keys (OpenAI, Supabase, Slack, etc.)

#### `wrangler.toml.local`
Copy `wrangler.toml` to `wrangler.toml.local`:
```bash
cp wrangler.toml wrangler.toml.local
```

Edit `wrangler.toml.local` with your organization-specific values in the `[vars]` section.

### 2. Add Your Documentation

Place your organization's documentation in the `docs/` directory. These files will be ignored by git if you add them to `.gitignore`.

### 3. Use Local Development Commands

The following npm scripts are available for local development:

```bash
# Start local development server with your organization's config
npm run dev:local

# Deploy to Cloudflare with your organization's config
npm run deploy:local

# Alternative start command for local development
npm run start:local
```

### 4. Testing Workflow

1. Use `npm run dev:local` to start the development server with your organization's branding
2. Test the Slack bot, Chat UI, and MCP server with your real documentation
3. Make any necessary code changes
4. Deploy to your testing environment with `npm run deploy:local`

### 5. Contributing Back

When contributing improvements back to the public repository:
1. Ensure all changes work with the generic configuration
2. Test with `npm run dev` (uses generic `.env` file)
3. Never commit `.env.local`, `wrangler.toml.local`, or organization-specific documentation
4. Keep all organization-specific content in ignored files

## File Structure

```
company-docs-mcp/
├── .env                    # Generic configuration (committed)
├── .env.example            # Template for environment variables (committed)
├── .env.local              # Your organization's configuration (ignored)
├── wrangler.toml           # Generic Cloudflare config (committed)
├── wrangler.toml.local     # Your organization's Cloudflare config (ignored)
├── docs/                   # Documentation directory
│   ├── *.md                # Your organization's docs (can be ignored)
│   └── examples/           # Generic examples (committed)
└── content/                # Ingested content
    └── entries/            # Your processed documentation (ignored)
```

## Important Notes

- All `*.local` files are automatically ignored by git
- The `content/` directory is ignored to prevent committing processed documentation
- Organization-specific documentation in `docs/` can be added to `.gitignore`
- Always test both configurations before deploying

## Switching Between Environments

- **Generic/Public**: Use standard commands (`npm run dev`, `npm run deploy`)
- **Organization-Specific**: Use local commands (`npm run dev:local`, `npm run deploy:local`)

This setup allows you to maintain a private testing environment with your organization's branding and documentation while contributing to a public, design-system agnostic repository.