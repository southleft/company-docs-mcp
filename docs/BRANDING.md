# Branding Configuration Guide

This guide explains how to customize the branding and appearance of your MCP Documentation Assistant chat interface.

## Environment Variables

Add these environment variables to your Cloudflare Worker or `.env` file to customize the chat interface:

### Required Variables

```bash
# Organization Name - appears in titles and headers
ORGANIZATION_NAME="Your Company Name"

# Organization Domain - used for meta tags and canonical URLs
ORGANIZATION_DOMAIN="https://yourcompany.com"
```

### Optional Branding Variables

```bash
# Logo URL - displays centered at the top of the chat interface
# Recommended: 300px max width, 120px max height, transparent background
ORGANIZATION_LOGO_URL="https://yourcompany.com/logo.png"

# Custom subtitle for the header (defaults to "Powered by MCP (Model Context Protocol)")
ORGANIZATION_SUBTITLE="Your AI-powered documentation assistant"

# Custom tagline for the welcome screen
# Defaults to: "Get instant answers from our comprehensive documentation. Ask about APIs, components, patterns, and best practices."
ORGANIZATION_TAGLINE="Ask me anything about our products, APIs, and documentation."
```

## Logo Guidelines

For the best appearance:

1. **Format**: PNG or SVG with transparent background
2. **Dimensions**: Maximum 300px width × 120px height
3. **File Size**: Keep under 100KB for optimal loading
4. **Hosting**: Host on a CDN or reliable server with CORS enabled

## Example Configuration

### Cloudflare Workers (wrangler.toml)

```toml
[vars]
ORGANIZATION_NAME = "Acme Corp"
ORGANIZATION_DOMAIN = "https://acme.com"
ORGANIZATION_LOGO_URL = "https://acme.com/logo.svg"
ORGANIZATION_SUBTITLE = "Acme Documentation Assistant"
ORGANIZATION_TAGLINE = "Get instant answers about our products, policies, and best practices."
```

### Local Development (.env)

```bash
ORGANIZATION_NAME=Acme Corp
ORGANIZATION_DOMAIN=https://acme.com
ORGANIZATION_LOGO_URL=https://acme.com/logo.svg
ORGANIZATION_SUBTITLE=Acme Documentation Assistant
ORGANIZATION_TAGLINE=Get instant answers about our products, policies, and best practices.
```

## UI Appearance

With these variables configured, your chat interface will display:

1. **Top Center (Welcome Screen)**:
   - Organization logo (if provided)
   - "{ORGANIZATION_NAME} Documentation" as the main title
   - Custom tagline description

2. **Header Bar**:
   - "{ORGANIZATION_NAME} Documentation" as the title
   - Custom subtitle or default "Powered by MCP"

3. **Footer**:
   - "{ORGANIZATION_NAME} Documentation Assistant • Powered by MCP"

## Mobile Responsiveness

The branding elements are fully responsive:
- Logo scales appropriately on smaller screens
- Text sizes adjust for mobile devices
- Layout remains centered and readable

## Fallback Behavior

If environment variables are not set:
- `ORGANIZATION_NAME` defaults to "Organization"
- Logo is hidden if `ORGANIZATION_LOGO_URL` is not provided
- Default taglines and subtitles are used

## Testing Your Branding

After configuring the environment variables:

1. Deploy your changes to Cloudflare Workers
2. Visit your chat interface URL
3. Verify the logo displays correctly
4. Check that all text reflects your organization
5. Test on mobile devices for responsiveness

## Troubleshooting

### Logo Not Displaying
- Ensure the URL is publicly accessible
- Check for CORS issues if hosting externally
- Verify the image format is supported (PNG, SVG, JPG)

### Text Not Updating
- Confirm environment variables are properly set in Cloudflare
- Redeploy the Worker after changes
- Clear browser cache if needed

### Layout Issues
- Keep logo dimensions within recommended limits
- Use high-quality images that scale well
- Test across different screen sizes
