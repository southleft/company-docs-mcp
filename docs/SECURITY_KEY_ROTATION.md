# Secret Management and Key Rotation Guide

## Overview

This guide covers how to manage secrets securely and rotate credentials when needed. All sensitive values (API keys, database credentials) should be stored as Cloudflare Worker secrets or in local `.env`/`.dev.vars` files that are excluded from version control.

If you suspect any credentials have been exposed, rotate them immediately using the steps below.

## Rotating Credentials

### 1. Rotate OpenAI API Key

**Why:** Exposed keys can lead to unauthorized usage and unexpected charges.

**Steps:**

1. **Login to OpenAI Platform**
   - Visit: https://platform.openai.com/api-keys
   - Sign in with your account

2. **Revoke Exposed Key**
   - Find the exposed key (starts with `sk-proj-`)
   - Click the "Revoke" button next to it
   - Confirm revocation

3. **Create New API Key**
   - Click "Create new secret key"
   - Give it a descriptive name (e.g., "Company Docs MCP - Production")
   - Set spending limits if desired
   - **Copy the key immediately** (you won't see it again)

4. **Update Cloudflare Worker**
   ```bash
   cd /path/to/company-docs-mcp
   echo "your-new-openai-key" | npx wrangler secret put OPENAI_API_KEY
   ```

5. **Update Local Development**
   - Edit `.dev.vars` file
   - Replace old key with new key
   - Do NOT commit this file

### 2. Rotate Supabase Credentials

**Why:** Supabase keys provide access to your database. The Service Role key has full database access and can bypass Row Level Security.

**Steps:**

1. **Login to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Navigate to your project

2. **Check for Unauthorized Access**
   - Go to Settings → API
   - Review recent API usage for suspicious activity
   - Check Logs for unexpected queries

3. **Rotate Anon Key** (if concerned)
   - Go to Settings → API
   - Under "Project API keys", find the `anon` key
   - Click "Reset" next to the key
   - Confirm reset
   - **Copy the new key immediately**

4. **Rotate Service Role Key** (Critical - Do this first!)
   - Go to Settings → API
   - Under "Project API keys", find the `service_role` key
   - Click "Reset" next to the key
   - Confirm reset
   - **Copy the new key immediately**

5. **Update Cloudflare Worker**
   ```bash
   cd /path/to/company-docs-mcp

   # Update Supabase URL (if you want to use a different project)
   echo "https://your-project.supabase.co" | npx wrangler secret put SUPABASE_URL

   # Update Anon Key
   echo "your-new-anon-key" | npx wrangler secret put SUPABASE_ANON_KEY

   # Update Service Role Key
   echo "your-new-service-role-key" | npx wrangler secret put SUPABASE_SERVICE_KEY
   ```

6. **Update Local Development**
   - Edit `.dev.vars` file
   - Replace all Supabase credentials
   - Do NOT commit this file

### 3. Review Database Security

After rotating Supabase keys, review your database security:

1. **Check Row Level Security (RLS)**
   - Ensure RLS is enabled on all tables
   - Review RLS policies for proper access control

2. **Review Recent Database Activity**
   - Check for unauthorized data access or modifications
   - Review table logs if available

3. **Consider Database Backup**
   - Create a backup before any cleanup
   - Store backup securely offline

## Proper Secret Management Going Forward

### Use Wrangler Secrets

**NEVER commit secrets to wrangler.toml again.** Use Cloudflare's secret management:

```bash
# Set production secrets (never visible in code)
echo "your-secret-value" | npx wrangler secret put SECRET_NAME

# List secrets (shows names only, not values)
npx wrangler secret list

# Delete a secret
npx wrangler secret delete SECRET_NAME
```

### Local Development (.dev.vars)

For local development, use `.dev.vars` file:

1. **Create .dev.vars** (already in .gitignore)
   ```bash
   OPENAI_API_KEY=your-development-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-development-anon-key
   SUPABASE_SERVICE_KEY=your-development-service-key
   ```

2. **Use Different Keys for Development**
   - Use separate API keys for dev/staging/production
   - Set spending limits on development keys
   - Regularly rotate development keys

### Configuration Template

Use `wrangler.toml.example` as a template:

1. **Copy Example**
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

2. **Update Only Non-Secret Values**
   - Organization name, domain, tagline
   - KV namespace IDs
   - Compatibility settings

3. **Never Commit Actual Secrets**
   - The `.gitignore` now blocks `wrangler.toml`
   - Only `wrangler.toml.example` should be in version control

## Git History Cleanup (Optional but Recommended)

**Warning:** This rewrites git history and requires force pushing. Coordinate with your team first.

If you want to remove secrets from git history entirely:

```bash
# Install BFG Repo-Cleaner (easier than git filter-branch)
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
cd /tmp
git clone --mirror https://github.com/your-org/company-docs-mcp.git

# Remove sensitive data
cd company-docs-mcp.git
bfg --replace-text <(echo 'your-exposed-key-pattern===>REMOVED')

# Cleanup and push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# Update all local clones
cd /path/to/your/local/clone
git fetch origin
git reset --hard origin/main
```

## Verification Checklist

After completing key rotation:

- [ ] OpenAI API key revoked and replaced
- [ ] Supabase Service Role key rotated
- [ ] Supabase Anon key rotated (if needed)
- [ ] Cloudflare Worker secrets updated via `wrangler secret put`
- [ ] Local `.dev.vars` file updated
- [ ] Database activity reviewed for suspicious access
- [ ] Row Level Security policies verified
- [ ] `wrangler.toml` contains no secrets
- [ ] `.gitignore` includes `wrangler.toml` and `.dev.vars`
- [ ] All services tested and working with new credentials
- [ ] Team members notified of key rotation
- [ ] Git history cleaned (optional)

## Monitoring Going Forward

Set up monitoring to detect unauthorized access:

1. **OpenAI Usage Monitoring**
   - Set up spending alerts at https://platform.openai.com/account/billing/limits
   - Review usage regularly
   - Set reasonable spending caps

2. **Supabase Monitoring**
   - Enable email alerts for unusual activity
   - Monitor API request logs
   - Set up budget alerts if on paid plan

3. **Cloudflare Monitoring**
   - Review Worker invocations regularly
   - Set up alerts for errors or unusual traffic

## Questions or Concerns?

If you believe credentials were actively exploited:

1. **Immediately rotate all keys** as described above
2. **Review all database changes** in the last 30 days
3. **Check OpenAI usage** for unexpected charges
4. **Contact support** if you see unauthorized activity:
   - OpenAI Support: https://help.openai.com/
   - Supabase Support: https://supabase.com/support

## Prevention Best Practices

To prevent future exposure:

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Enable secret scanning** on GitHub/GitLab
4. **Regularly rotate keys** even without exposure (quarterly)
5. **Use different keys** for development, staging, production
6. **Set spending limits** on all API keys
7. **Review access logs** regularly
8. **Train team members** on secret management best practices
