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
// Content cleaning — strip markdown artifacts for clean plain text
// ---------------------------------------------------------------------------

/** Strip all markdown formatting to produce clean readable text */
function cleanContent(content: string): string {
  let text = content;
  // Strip YAML frontmatter
  text = text.replace(/^---[\s\S]*?---\n*/m, '');
  // Convert markdown tables to readable key-value lists
  text = convertTables(text);
  // Strip markdown headings but keep the text
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  // Convert markdown links [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Strip image syntax ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  // Strip bold/italic markers
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  // Strip blockquote markers
  text = text.replace(/^>\s?/gm, '');
  // Strip horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  // Convert markdown dashes to bullets
  text = text.replace(/^- /gm, '• ');
  // Collapse excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
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
  // Markdown links [text](url) → <url|text>
  str = str.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<$2|$1>');
  // Strip image syntax ![alt](url)
  str = str.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  // Convert remaining markdown dashes to bullet points
  str = str.replace(/^- /gm, '• ');
  // Strip any remaining markdown table syntax (separator rows, pipe chars in data)
  str = str.replace(/^\|[-| :]+\|\s*$/gm, '');
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
// Slash command entry point
// ---------------------------------------------------------------------------

export async function handleSlackCommand(request: Request, env: any, ctx?: any): Promise<Response> {
  const signature = request.headers.get('X-Slack-Signature');
  const timestamp = request.headers.get('X-Slack-Request-Timestamp');

  if (!signature || !timestamp) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
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
• Open with a 1-2 sentence summary directly answering the question
• Use *bold text* for section headers (single asterisks, never ## or #)
• Use • bullet points for lists (never dashes -)
• Include code examples in triple-backtick blocks if the docs have them
• Convert any tables into bullet-point lists
• Be thorough — cover properties, variants, usage guidelines, code examples
• Do NOT add a Sources section — the system adds that automatically
• Keep response under 4000 characters`;

// ---------------------------------------------------------------------------
// Core: search → synthesize → respond
// ---------------------------------------------------------------------------

async function searchAndRespond(command: SlackSlashCommand, env: any) {
  let usedResults: Array<{ title: string; content: string }> = [];

  try {
    const apiKey = env?.OPENAI_API_KEY;
    const model = env?.OPENAI_MODEL || 'gpt-4o';

    // --- Step 1: Search documentation ---
    const searchResults = await withTimeout(
      searchWithSupabase({ query: command.text, limit: 5 }, env),
      10000,
      'Slack search'
    );

    if (searchResults.length === 0) {
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
      return `[${i + 1}] ${entry.title}\n${cleanContent(entry.content).slice(0, 2500)}`;
    }).join('\n\n---\n\n');

    const userMessage = `Question: "${command.text}"\n\nDocumentation:\n\n${cleanResults}`;

    // --- Step 2: Try OpenAI synthesis ---
    let responseText = '';

    if (apiKey) {
      responseText = await tryOpenAI(apiKey, model, userMessage);
    }

    // --- Step 3: Try Cloudflare Workers AI as fallback ---
    if (!responseText && env.AI) {
      responseText = await tryWorkersAI(env.AI, userMessage);
    }

    // --- Step 4: Final fallback — well-formatted raw content ---
    if (!responseText) {
      responseText = buildFallbackResponse(command.text, topResults);
    }

    // --- Step 5: Convert to Slack mrkdwn and send ---
    responseText = toSlackMrkdwn(responseText);

    await sendSlackResponse(command.response_url, env, {
      text: responseText,
      sources: usedResults,
    });

  } catch (error: any) {
    console.error('[Slack] Fatal error:', error?.message || error);

    await fetch(command.response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: 'An error occurred while searching the documentation. Please try again.',
      })
    });
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
      max_tokens: 2500,
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
    const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 2500,
    });

    const text = result?.response || '';
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

function buildFallbackResponse(
  query: string,
  results: Array<{ title: string; content: string }>
): string {
  if (results.length === 0) return `No results found for "${query}".`;

  const top = results[0];
  const clean = cleanContent(top.content);

  // Get all meaningful paragraphs
  const paragraphs = clean.split(/\n{2,}/).filter(p => p.trim().length > 15);

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
      const firstLine = cleanContent(r.content).split('\n').find(l => l.trim().length > 20) || '';
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
        const figmaMatch = entry.content?.match(/https:\/\/www\.figma\.com\/[^\s)]+/);
        if (figmaMatch) {
          sourcesText += `• <${figmaMatch[0]}|${entry.title}>\n`;
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

  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'in_channel', blocks })
  });
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
