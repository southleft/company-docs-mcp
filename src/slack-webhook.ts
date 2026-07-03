/**
 * Slack webhook handler for Cloudflare Workers
 * Handles slash commands directly without Socket Mode
 *
 * AI strategy: OpenAI → Cloudflare Workers AI → formatted fallback
 */

import { searchWithSupabase } from './lib/search-handler';
import { Category } from './lib/content';
import { withTimeout } from './lib/utils';

// ---------------------------------------------------------------------------
// Content preparation — preserve structure for AI and Slack formatting
// ---------------------------------------------------------------------------

/** Lightweight content prep for AI — preserves URLs and structure */
function prepareForAI(content: string): string {
  let text = content;
  // Strip YAML frontmatter
  text = text.replace(/^---[\s\S]*?---\n*/m, '');
  // Convert markdown tables to readable format
  text = convertTables(text);
  // Strip image syntax ![alt](url) → alt text
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  // Keep markdown links [text](url) intact — AI passes them through, toSlackMrkdwn() converts later
  // Convert headings to labeled sections
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1:');
  // Strip bold/italic markers
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  // Strip blockquote markers
  text = text.replace(/^>\s?/gm, '');
  // Strip horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // Keep list items as dashes
  // Collapse excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Extract resource links (Figma, Storybook, etc.) from raw markdown and format as Slack links */
function extractResourceLinks(content: string): string {
  const links: string[] = [];
  // Match markdown links [text](url) with http(s) URLs
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = linkRe.exec(content)) !== null) {
    const label = match[1].trim();
    const url = match[2].trim();
    // Only pick resource-style links (short labels, not full sentences)
    if (label.length <= 40 && !seen.has(label)) {
      seen.add(label);
      links.push(`<${url}|${label}>`);
    }
    // Stop after first few — these are typically the header resource links
    if (links.length >= 5) break;
  }

  return links.length > 0 ? links.join(' | ') + '\n\n' : '';
}

/** Convert markdown tables to readable bullet lists */
function convertTables(text: string): string {
  // Match table blocks: header row, separator row, data rows
  const tableRe = /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm;

  return text.replace(tableRe, (_match, headerRow: string, _sep: string, bodyRows: string) => {
    const headers = headerRow.split('|').map((h: string) => h.trim()).filter(Boolean);
    const rows = bodyRows.trim().split('\n');
    let result = '';

    for (const row of rows) {
      const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
      if (cells.length === 0) continue;

      // Format as "• header1: value1, header2: value2, ..."
      const parts: string[] = [];
      for (let i = 0; i < cells.length && i < headers.length; i++) {
        if (cells[i] && cells[i] !== '-') {
          parts.push(`${headers[i]}: ${cells[i]}`);
        }
      }
      if (parts.length > 0) {
        result += `• ${parts.join(' | ')}\n`;
      }
    }

    return result + '\n';
  });
}

// ---------------------------------------------------------------------------
// Slack mrkdwn conversion — convert any remaining markdown to Slack format
// ---------------------------------------------------------------------------

/** Convert standard markdown to Slack mrkdwn, preserving code blocks */
function toSlackMrkdwn(text: string): string {
  const codeBlockRe = /```[\s\S]*?```/g;
  let last = 0;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = codeBlockRe.exec(text)) !== null) {
    out += transformInline(text.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  out += transformInline(text.slice(last));
  return out;
}

function transformInline(str: string): string {
  // Headings → bold lines
  str = str.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  // Bold **text** → *text*
  str = str.replace(/\*\*(.+?)\*\*/g, '*$1*');
  // Markdown links [text](url) → <url|text> for http(s) URLs
  str = str.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<$2|$1>');
  // Strip remaining markdown links (non-http, e.g. relative paths) → just text
  str = str.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Strip image syntax ![alt](url)
  str = str.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  // Convert __text__ → _text_ (Slack italic)
  str = str.replace(/__(.+?)__/g, '_$1_');
  // Normalize all bullet/list markers to • (Slack has no native list syntax)
  str = str.replace(/^- /gm, '• ');
  str = str.replace(/^\* /gm, '• ');
  // Strip markdown table separator rows
  str = str.replace(/^\|[-| :]+\|\s*$/gm, '');
  // Convert remaining table data rows to readable bullet format
  str = str.replace(/^\|(.+)\|\s*$/gm, (_match: string, inner: string) => {
    const cells = inner.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length === 0) return '';
    if (cells.length === 1) return '• ' + cells[0];
    return '• *' + cells[0] + '* — ' + cells.slice(1).join(', ');
  });
  return str;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface SlackSlashCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  accessory?: any;
}

// ---------------------------------------------------------------------------
// Slack request signature verification
// https://api.slack.com/authentication/verifying-requests-from-slack
// ---------------------------------------------------------------------------

const SLACK_REPLAY_WINDOW_SECONDS = 60 * 5;

async function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string
): Promise<boolean> {
  // Reject stale timestamps to prevent replay attacks
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SLACK_REPLAY_WINDOW_SECONDS) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`v0:${timestamp}:${rawBody}`));
  const expected = `v0=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/** Only ever POST responses back to Slack's own webhook host. */
function isSlackResponseUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'hooks.slack.com';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Slash command entry point
// ---------------------------------------------------------------------------

export async function handleSlackCommand(request: Request, env: any, ctx?: any): Promise<Response> {
  const signature = request.headers.get('X-Slack-Signature');
  const timestamp = request.headers.get('X-Slack-Request-Timestamp');

  if (!signature || !timestamp) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fail closed: without the signing secret we cannot authenticate Slack,
  // and this endpoint searches private docs and spends AI budget.
  if (!env.SLACK_SIGNING_SECRET) {
    console.error('[Slack] SLACK_SIGNING_SECRET is not configured; rejecting request');
    return new Response('Slack integration not configured', { status: 401 });
  }

  // Read the raw body for HMAC verification, then parse it as form data
  const rawBody = await request.text();
  const validSignature = await verifySlackSignature(
    env.SLACK_SIGNING_SECRET,
    signature,
    timestamp,
    rawBody
  );
  if (!validSignature) {
    console.error('[Slack] Request signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = new URLSearchParams(rawBody);
  const command: SlackSlashCommand = {
    token: formData.get('token') as string,
    team_id: formData.get('team_id') as string,
    team_domain: formData.get('team_domain') as string,
    channel_id: formData.get('channel_id') as string,
    channel_name: formData.get('channel_name') as string,
    user_id: formData.get('user_id') as string,
    user_name: formData.get('user_name') as string,
    command: formData.get('command') as string,
    text: formData.get('text') as string,
    response_url: formData.get('response_url') as string,
    trigger_id: formData.get('trigger_id') as string,
  };

  if (command.command !== (env.SLACK_SLASH_COMMAND || '/docs')) {
    return new Response('Invalid command', { status: 400 });
  }

  if (!command.text?.trim()) {
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: 'Please provide a search query.',
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*How to use ${command.command}:*\n\n` +
                `\`${command.command} alert component\` — Learn about a specific component\n` +
                `\`${command.command} design tokens\` — Understand design tokens\n` +
                `\`${command.command} accessibility\` — Explore accessibility guidelines`
        }
      }]
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const immediateResponse = {
    response_type: 'in_channel',
    text: `Searching for: "${command.text}"...`
  };

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(searchAndRespond(command, env));
  } else {
    searchAndRespond(command, env).catch(err =>
      console.error('[Slack] Error in searchAndRespond:', err)
    );
  }

  return new Response(JSON.stringify(immediateResponse), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ---------------------------------------------------------------------------
// AI synthesis prompt (shared between OpenAI and Workers AI)
// ---------------------------------------------------------------------------

const AI_SYSTEM_PROMPT = `You are a documentation assistant answering a question in Slack. Rewrite the provided documentation into a clear, editorial-style answer.

IMPORTANT: Do NOT invent information. Only use facts from the provided documentation.

FORMAT RULES:
- Open with a 1-2 sentence summary directly answering the question
- Use *bold text* for section headers (single asterisks wrapping text, never ## or #)
- Preserve markdown links [text](url) exactly as they appear — the system will format them for Slack
- Use • (bullet character) for list items, never - or * symbols
- Convert markdown tables into • bullet lists (e.g. "• *Danger* — #FFF1F2, CircleAlert, Errors"). NEVER output raw | pipe table syntax
- Include code examples in triple-backtick blocks if the docs have them
- Be thorough — cover properties, variants, usage guidelines, code examples
- Do NOT include resource link bars (Open in Figma, View Source, Storybook) — the system adds those
- Do NOT add a Sources section — the system adds that automatically
- Keep response under 4000 characters`;

// ---------------------------------------------------------------------------
// Core: search → synthesize → respond
// ---------------------------------------------------------------------------

async function searchAndRespond(command: SlackSlashCommand, env: any) {
  console.log(`[Slack] searchAndRespond START: query="${command.text}" response_url="${command.response_url?.slice(0, 80)}..."`);
  console.log(`[Slack] env check: AI=${!!env?.AI} EMBEDDING_PROVIDER=${env?.EMBEDDING_PROVIDER} SUPABASE_URL=${!!env?.SUPABASE_URL} OPENAI_API_KEY=${!!env?.OPENAI_API_KEY}`);

  let usedResults: Array<{ title: string; content: string }> = [];

  try {
    const apiKey = env?.OPENAI_API_KEY;
    const model = env?.OPENAI_MODEL || 'gpt-4o';

    // --- Step 1: Search documentation ---
    console.log('[Slack] Step 1: Starting search...');
    const searchResults = await withTimeout(
      searchWithSupabase({ query: command.text, limit: 5 }, env),
      10000,
      'Slack search'
    );
    console.log(`[Slack] Step 1 complete: ${searchResults.length} results`);

    if (searchResults.length === 0) {
      console.log('[Slack] No results — sending empty response');
      await sendSlackResponse(command.response_url, env, {
        text: `No documentation found matching "${command.text}". Try different keywords.`,
        sources: [],
      });
      return;
    }

    const topResults = searchResults.slice(0, 3);
    usedResults = topResults;

    // Prepare clean content for AI (used by both OpenAI and Workers AI)
    const cleanResults = topResults.map((entry, i) => {
      return `[${i + 1}] ${entry.title}\n${prepareForAI(entry.content).slice(0, 2500)}`;
    }).join('\n\n---\n\n');

    const userMessage = `Question: "${command.text}"\n\nDocumentation:\n\n${cleanResults}`;

    // --- Step 2: Try OpenAI synthesis ---
    let responseText = '';

    if (apiKey) {
      console.log('[Slack] Step 2: Trying OpenAI...');
      responseText = await tryOpenAI(apiKey, model, userMessage);
    } else {
      console.log('[Slack] Step 2: No OpenAI key, skipping');
    }

    // --- Step 3: Try Cloudflare Workers AI as fallback ---
    if (!responseText && env.AI) {
      console.log('[Slack] Step 3: Trying Workers AI...');
      responseText = await tryWorkersAI(env.AI, userMessage);
    }

    // --- Step 4: Final fallback — well-formatted raw content ---
    if (!responseText) {
      console.log('[Slack] Step 4: Using formatted fallback');
      responseText = buildFallbackResponse(command.text, topResults);
    }

    // --- Step 5: Convert to Slack mrkdwn, prepend resource links, and send ---
    console.log(`[Slack] Step 5: Sending response (${responseText.length} chars) to response_url`);
    responseText = toSlackMrkdwn(responseText);

    // Strip AI's resource link bars (e.g. "Open in Figma | View Source | Storybook")
    // — these are unreliable (non-http links become plain text). extractResourceLinks handles it.
    responseText = responseText.replace(/^.*(?:Figma|View Source|Storybook).*\|.*(?:Figma|View Source|Storybook).*$/gm, '');
    responseText = responseText.replace(/\n{3,}/g, '\n\n').trim();

    // Prepend resource links extracted from raw source (only clickable http links)
    const resourceLinks = extractResourceLinks(topResults[0].content);
    if (resourceLinks) {
      responseText = resourceLinks + responseText;
    }

    await sendSlackResponse(command.response_url, env, {
      text: responseText,
      sources: usedResults,
    });
    console.log('[Slack] searchAndRespond COMPLETE');

  } catch (error: any) {
    console.error('[Slack] Fatal error:', error?.message || error);
    console.error('[Slack] Fatal error stack:', error?.stack?.slice(0, 500));

    try {
      if (!isSlackResponseUrl(command.response_url)) {
        console.error('[Slack] Refusing to POST error to non-Slack response_url');
        return;
      }
      const errRes = await fetch(command.response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: 'An error occurred while searching the documentation. Please try again.',
        })
      });
      console.error(`[Slack] Error handler response_url: HTTP ${errRes.status}`);
    } catch (fetchErr: any) {
      console.error(`[Slack] Error handler fetch also failed: ${fetchErr.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// AI Tier 1: OpenAI (raw fetch for Workers compatibility)
// ---------------------------------------------------------------------------

async function tryOpenAI(apiKey: string, model: string, userMessage: string): Promise<string> {
  try {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 2500,
      temperature: 0.3,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content || '';
      if (text) {
        console.log(`[Slack] OpenAI success: ${text.length} chars, model=${model}`);
        return text;
      }
    } else {
      const errBody = await response.text().catch(() => '');
      console.error(`[Slack] OpenAI HTTP ${response.status}: ${errBody.slice(0, 300)}`);
    }
  } catch (err: any) {
    const errType = err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR';
    console.error(`[Slack] OpenAI ${errType}: ${err.message}`);
  }
  return '';
}

// ---------------------------------------------------------------------------
// AI Tier 2: Cloudflare Workers AI (built-in, no external calls)
// ---------------------------------------------------------------------------

async function tryWorkersAI(ai: any, userMessage: string): Promise<string> {
  try {
    const result = await withTimeout(
      ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 2500,
      }),
      15000,
      'Workers AI synthesis'
    );

    const text = (result as { response?: string } | undefined)?.response || '';
    if (text) {
      console.log(`[Slack] Workers AI success: ${text.length} chars`);
      return text;
    }
  } catch (err: any) {
    console.error(`[Slack] Workers AI error: ${err.message}`);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Tier 3: Formatted fallback when all AI is unavailable
// ---------------------------------------------------------------------------

/** Strip frontmatter and images, then convert to Slack mrkdwn */
function prepareForFallback(content: string): string {
  let text = content;
  text = text.replace(/^---[\s\S]*?---\n*/m, '');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  return text;
}

function buildFallbackResponse(
  query: string,
  results: Array<{ title: string; content: string }>
): string {
  if (results.length === 0) return `No results found for "${query}".`;

  const top = results[0];
  const formatted = toSlackMrkdwn(prepareForFallback(top.content));

  // Get all meaningful paragraphs
  const paragraphs = formatted.split(/\n{2,}/).filter(p => p.trim().length > 15);

  // Build a rich response — up to 5000 chars (will be split into Slack blocks)
  let response = `*${top.title}*\n\n`;
  const charBudget = 5000;

  for (const para of paragraphs) {
    if (response.length + para.length > charBudget) break;
    response += para + '\n\n';
  }

  // Mention related results briefly
  if (results.length > 1) {
    response += '_See also:_\n';
    results.slice(1, 3).forEach(r => {
      const firstLine = toSlackMrkdwn(prepareForFallback(r.content)).split('\n').find(l => l.trim().length > 20) || '';
      response += `• *${r.title}* — ${firstLine.slice(0, 120)}\n`;
    });
  }

  return response.trim();
}

// ---------------------------------------------------------------------------
// Send the formatted response to Slack via response_url
// ---------------------------------------------------------------------------

async function sendSlackResponse(
  responseUrl: string,
  env: any,
  payload: {
    text: string;
    sources: Array<{ title: string; content?: string }>;
  }
) {
  if (!isSlackResponseUrl(responseUrl)) {
    console.error(`[Slack] Refusing to POST to non-Slack response_url: ${responseUrl.slice(0, 60)}`);
    return;
  }

  const blocks: SlackBlock[] = [];
  const orgName = env.ORGANIZATION_NAME || 'Documentation';

  // Header
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: orgName, emoji: true }
  });

  blocks.push({ type: 'divider' });

  // Response body — split into 2900-char sections for Slack's 3000-char block limit
  const parts = splitForSlack(payload.text, 2900);
  for (const part of parts) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: part }
    });
  }

  // Sources — extract real URLs (e.g. Figma) from content, or show plain names
  if (payload.sources.length > 0) {
    blocks.push({ type: 'divider' });

    const seen = new Set<string>();
    let sourcesText = '*Sources:*\n';

    for (const entry of payload.sources) {
      if (entry.title && !seen.has(entry.title)) {
        seen.add(entry.title);
        const urlMatch = entry.content?.match(/https?:\/\/[^\s)>"]+/);
        if (urlMatch) {
          sourcesText += `• <${urlMatch[0]}|${entry.title}>\n`;
        } else {
          sourcesText += `• ${entry.title}\n`;
        }
      }
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: sourcesText }]
    });
  }

  // Include text fallback alongside blocks (Slack best practice)
  const textFallback = payload.text.slice(0, 3000);
  const body = JSON.stringify({
    response_type: 'in_channel',
    replace_original: true,
    text: textFallback,
    blocks,
  });
  console.log(`[Slack] Posting to response_url: ${responseUrl.slice(0, 60)}... body=${body.length} bytes, blocks=${blocks.length}`);

  const slackRes = await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const resBody = await slackRes.text().catch(() => '');
  if (!slackRes.ok) {
    console.error(`[Slack] response_url failed: HTTP ${slackRes.status} — ${resBody.slice(0, 500)}`);
  } else {
    console.log(`[Slack] response_url success: HTTP ${slackRes.status} body="${resBody.slice(0, 200)}"`);
  }
}

// ---------------------------------------------------------------------------
// Split text into Slack-safe chunks by paragraph/sentence boundaries
// ---------------------------------------------------------------------------

function splitForSlack(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const parts: string[] = [];
  const paragraphs = text.split(/\n\n/);
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;

    if (candidate.length > maxLen && current) {
      parts.push(current.trim());
      current = para;
    } else if (para.length > maxLen) {
      if (current) parts.push(current.trim());
      const sentences = para.split(/(?<=[.!?])\s+/);
      current = '';
      for (const sentence of sentences) {
        const test = current ? current + ' ' + sentence : sentence;
        if (test.length > maxLen && current) {
          parts.push(current.trim());
          current = sentence;
        } else {
          current = test;
        }
      }
    } else {
      current = candidate;
    }

    if (parts.length >= 10) break;
  }

  if (current.trim()) parts.push(current.trim());
  return parts.length > 0 ? parts : [text.slice(0, maxLen)];
}
