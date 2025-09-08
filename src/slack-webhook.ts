/**
 * Slack webhook handler for Cloudflare Workers
 * Handles slash commands directly without Socket Mode
 * Now uses the same AI-powered search as the chat UI for consistency
 */

import OpenAI from 'openai';
import { searchWithSupabase } from './lib/search-handler';
import { Category } from './lib/content';

// Timeout helper function
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

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

export async function handleSlackCommand(request: Request, env: any, ctx?: any): Promise<Response> {
  // Verify the request is from Slack
  const signature = request.headers.get('X-Slack-Signature');
  const timestamp = request.headers.get('X-Slack-Request-Timestamp');
  
  if (!signature || !timestamp) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Parse the command
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

  // Validate the command
  if (command.command !== (env.SLACK_SLASH_COMMAND || '/docs')) {
    return new Response('Invalid command', { status: 400 });
  }

  // Handle empty query
  if (!command.text?.trim()) {
    return new Response(JSON.stringify({
      response_type: 'ephemeral',
      text: '❓ Please provide a search query.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*How to use ${command.command}:*\n\n` +
                  `• \`${command.command} tokens\` - Learn about design tokens\n` +
                  `• \`${command.command} theming\` - Understand theming in Canvas Kit\n` +
                  `• \`${command.command} components\` - Explore available components`
          }
        }
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Immediately acknowledge the command
  const immediateResponse = {
    response_type: 'in_channel',
    text: `🔍 Searching for: "${command.text}"...`
  };

  // Use waitUntil to keep the worker alive for the async response
  // This ensures the async work completes even after we return the immediate response
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(searchAndRespond(command, env));
  } else {
    // Fallback for environments without waitUntil
    console.log('[Slack] Warning: No execution context available, async response may not complete');
    searchAndRespond(command, env).catch(err => 
      console.error('[Slack] Error in searchAndRespond:', err)
    );
  }

  return new Response(JSON.stringify(immediateResponse), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function searchAndRespond(command: SlackSlashCommand, env: any) {
  console.log('[Slack] searchAndRespond started for query:', command.text);
  try {
    // Use the same AI-powered search as the chat UI
    const apiKey = env?.OPENAI_API_KEY;
    const model = env?.OPENAI_MODEL || "gpt-4o";
    
    console.log('[Slack] Using model:', model);
    
    if (!apiKey) {
      console.error('[Slack] No OpenAI API key configured');
      throw new Error("OpenAI API key not configured");
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: apiKey,
      timeout: 45000,
      maxRetries: 1,
    });

    // First, search the documentation using vector search (same as chat UI)
    console.log('[Slack] Starting searchWithSupabase...');
    const searchResults = await withTimeout(
      searchWithSupabase({
        query: command.text,
        limit: 50,  // Get comprehensive results
      }, env),
      10000,
      'Slack search'
    );

    console.log('[Slack] Search returned', searchResults.length, 'results');
    let responseText = '';

    if (searchResults.length === 0) {
      responseText = `No documentation found matching "${command.text}". Please try different keywords or check the spelling.`;
    } else {
      // Format search results for the AI
      const formattedResults = searchResults.map((entry, index) =>
        `**${index + 1}. ${entry.title}**
Category: ${entry.metadata.category}
Tags: ${entry.metadata.tags.join(", ")}
Source: ${entry.source?.location || entry.metadata?.source_url || "N/A"}

${entry.content.slice(0, 10000)}${entry.content.length > 10000 ? "..." : ""}
---`
      ).join("\n\n");

      // Create the AI prompt - More explicit about comprehensive responses for Slack
      const systemPrompt = `You are a Workday CanvasKit documentation assistant responding in Slack.
      
RESPONSE FORMAT - EXTREMELY IMPORTANT:
- You MUST provide EXHAUSTIVE, COMPREHENSIVE responses that include EVERY detail from the search results
- DO NOT summarize, shorten, or condense information - include EVERYTHING relevant
- Include ALL code examples, ALL implementation details, ALL guidelines, ALL best practices
- When you find multiple relevant sections, include information from EVERY SINGLE ONE
- List out ALL tokens, ALL utilities, ALL props, ALL methods mentioned in the documentation
- Provide step-by-step implementations when available
- Include ALL sources and references found
- Your response should be LONG and DETAILED - users want complete expertise, not summaries
- Minimum response should be several paragraphs with bullet points, code examples, and thorough explanations
- If the documentation mentions 10 things, include all 10 things - don't pick just a few
- Format for Slack using markdown (bold with *, code with backticks)
- Keep responses well-structured with sections and clear organization

NEVER SHORTEN OR SUMMARIZE - users explicitly want COMPLETE, DETAILED, EXHAUSTIVE answers in Slack.`;

      // Get AI response
      console.log('[Slack] Calling OpenAI with', formattedResults.length, 'formatted results...');
      try {
        const completion = await withTimeout(
          openai.chat.completions.create({
            model: model,
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: `Based on these search results about "${command.text}", provide a comprehensive answer:\n\n${formattedResults}`
              }
            ],
            max_tokens: 16000,  // Maximum tokens for comprehensive Slack responses
            temperature: 0.3,
          }),
          30000,
          'OpenAI completion for Slack'
        );

        responseText = completion.choices[0].message.content || 'Unable to generate response.';
        console.log('[Slack] OpenAI response length:', responseText.length, 'characters');
      } catch (aiError: any) {
        console.error('AI Error:', aiError);
        // Fallback to showing raw search results if AI fails
        responseText = `Found ${searchResults.length} results for "${command.text}":\n\n`;
        searchResults.slice(0, 3).forEach((entry, index) => {
          responseText += `*${index + 1}. ${entry.title}*\n`;
          responseText += `${entry.content.slice(0, 500)}...\n\n`;
        });
      }
    }

    // Format response for Slack blocks
    let blocks: SlackBlock[] = [];
    
    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📚 CanvasKit Documentation',
        emoji: true
      }
    });

    // Context with query
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Answer for *"${command.text}"*`
        }
      ]
    });

    blocks.push({ type: 'divider' });

    // Split long responses into multiple sections for Slack's block limits
    const maxSectionLength = 3000;
    const responseParts = [];
    
    if (responseText.length > maxSectionLength) {
      // Split by paragraphs to avoid breaking in the middle of content
      const paragraphs = responseText.split('\n\n');
      let currentPart = '';
      
      for (const paragraph of paragraphs) {
        if ((currentPart + '\n\n' + paragraph).length > maxSectionLength && currentPart) {
          responseParts.push(currentPart);
          currentPart = paragraph;
        } else {
          currentPart = currentPart ? currentPart + '\n\n' + paragraph : paragraph;
        }
      }
      if (currentPart) {
        responseParts.push(currentPart);
      }
    } else {
      responseParts.push(responseText);
    }

    // Add response sections
    responseParts.forEach((part, index) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: part
        }
      });
      
      if (index < responseParts.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });

    // Send the follow-up message
    await fetch(command.response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        blocks
      })
    });

  } catch (error) {
    console.error('Slack command error:', error);
    
    // Send error message
    await fetch(command.response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ An error occurred while searching the documentation. Please try again later.'
      })
    });
  }
}