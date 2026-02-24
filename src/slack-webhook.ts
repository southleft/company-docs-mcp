/**
 * Slack webhook handler for Cloudflare Workers
 * Handles slash commands directly without Socket Mode
 * Now uses the same AI-powered search as the chat UI for consistency
 */

import OpenAI from 'openai';
import { searchWithSupabase } from './lib/search-handler';
import { Category } from './lib/content';
import { withTimeout } from './lib/utils';

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
                  `• \`${command.command} theming\` - Understand theming in your design system\n` +
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
    console.log('[Slack] Available env vars:', Object.keys(env || {}).filter(k => k.includes('OPENAI')));
    console.log('[Slack] Raw OPENAI_MODEL value:', env?.OPENAI_MODEL);
    
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

      // Create the AI prompt - AGGRESSIVE comprehensive response requirements
      const systemPrompt = `You are a ${env.ORGANIZATION_NAME || 'documentation'} assistant responding in Slack.

CRITICAL MANDATE - YOU MUST GENERATE EXTREMELY LONG, COMPREHENSIVE RESPONSES:

1. **MINIMUM LENGTH REQUIREMENT**: Your response MUST be at least 3000 words for any substantial topic. This is NON-NEGOTIABLE.

2. **EXHAUSTIVE DETAIL MANDATE**:
   - Include EVERY SINGLE piece of information from the documentation
   - Provide ALL code examples found in the documentation - do not skip ANY
   - List EVERY token, EVERY utility, EVERY prop, EVERY method mentioned
   - Include ALL implementation patterns, ALL use cases, ALL variations
   - Provide complete, runnable code examples for EACH concept
   - Include ALL edge cases, ALL considerations, ALL best practices

3. **COMPREHENSIVE STRUCTURE**:
   - Start with a detailed overview (500+ words)
   - Include multiple main sections with extensive subsections
   - Provide in-depth explanations for each concept (200+ words per concept)
   - Include complete code implementations (not snippets)
   - Add detailed examples for every single use case
   - Include troubleshooting sections
   - Provide migration guides if applicable
   - Include performance considerations
   - Add accessibility guidelines
   - Include testing strategies
   - ALWAYS end with a "Sources" section listing the documentation titles you referenced

4. **NO SUMMARIZATION ALLOWED**:
   - NEVER use phrases like "in summary" or "briefly"
   - NEVER skip content with "etc." or "and more"
   - NEVER abbreviate explanations
   - ALWAYS expand on every point mentioned
   - ALWAYS include full context for every statement

5. **CODE EXAMPLE REQUIREMENTS**:
   - Every code example must be COMPLETE and RUNNABLE
   - Include all imports, all setup, all configuration
   - Show multiple variations of each implementation
   - Include both TypeScript and JavaScript versions when applicable
   - Add detailed comments explaining every line

6. **RESPONSE LENGTH VERIFICATION**:
   - If your response is less than 3000 words, you have FAILED
   - Aim for 5000-10000 words for comprehensive topics
   - Use the FULL context provided to generate extensive content

REMEMBER: The user has EXPLICITLY requested comprehensive, professional-grade documentation. They want to see EVERYTHING the documentation has to offer on this topic. DO NOT HOLD BACK. GENERATE THE LONGEST, MOST DETAILED RESPONSE POSSIBLE.`;

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
                content: `Based on these search results about "${command.text}", provide THE MOST COMPREHENSIVE, DETAILED, AND EXHAUSTIVE answer possible.

IMPORTANT: Generate a response that is AT LEAST 3000 words long. Include EVERY piece of information from the documentation below. Do NOT summarize or shorten anything. The user wants to see EVERYTHING about this topic.

Here are the complete documentation sections to include in your response:

${formattedResults}

Remember: Your response MUST be extremely long and detailed. Include ALL information, ALL code examples, ALL implementation details. Aim for 5000-10000 words if the documentation supports it.`
              }
            ],
            max_tokens: 16000,  // Maximum tokens for comprehensive Slack responses
            temperature: 0.1,  // Lower temperature for more consistent, detailed responses
          }),
          30000,
          'OpenAI completion for Slack'
        );

        responseText = completion.choices[0].message.content || 'Unable to generate response.';
        console.log('[Slack] OpenAI response length:', responseText.length, 'characters');
        console.log('[Slack] OpenAI tokens used:', completion.usage?.total_tokens || 'unknown');
        console.log('[Slack] Response preview (first 200 chars):', responseText.substring(0, 200));
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
    
    // Header with version for tracking deployments
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📚 ${env.ORGANIZATION_NAME || 'CanvasKit Documentation'}`,
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
    // Slack supports 3000 chars per text block, up to 50 blocks (150K chars total)
    const maxSectionLength = 2900; // Slightly under 3000 for safety
    const responseParts = [];
    let totalCharsSent = 0;

    if (responseText.length > maxSectionLength) {
      // Split by sentences first, then paragraphs for better content preservation
      const sentences = responseText.split(/(?<=[.!?])\s+/);
      let currentPart = '';
      
      for (const sentence of sentences) {
        const potentialPart = currentPart ? currentPart + ' ' + sentence : sentence;
        
        if (potentialPart.length > maxSectionLength && currentPart) {
          // Only add if we have content
          if (currentPart.trim()) {
            responseParts.push(currentPart.trim());
            totalCharsSent += currentPart.length;
          }
          currentPart = sentence;
        } else {
          currentPart = potentialPart;
        }
        
        // Safety: limit to 45 blocks to stay under Slack's 50 block limit
        if (responseParts.length >= 45) {
          if (currentPart.trim()) {
            responseParts.push(currentPart.trim() + '\n\n...[Response truncated due to Slack limits]');
          }
          break;
        }
      }
      
      // Add the last part if it exists and we haven't hit limits
      if (currentPart.trim() && responseParts.length < 45) {
        responseParts.push(currentPart.trim());
        totalCharsSent += currentPart.length;
      }
      
      console.log(`[Slack] Split response: ${responseParts.length} parts, ${totalCharsSent}/${responseText.length} chars sent`);
    } else {
      responseParts.push(responseText);
      totalCharsSent = responseText.length;
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

    // Add sources section with clickable links
    if (searchResults.length > 0) {
      blocks.push({ type: 'divider' });
      
      // Create sources text with clickable links to the web UI
      let sourcesText = '*Sources:*\n';
      const uniqueSources = new Set();
      const baseUrl = 'https://company-docs-mcp.southleft-llc.workers.dev';
      
      // Collect unique sources from search results (up to 10)
      let sourceCount = 0;
      searchResults.forEach(entry => {
        if (sourceCount < 10 && entry.title && !uniqueSources.has(entry.title)) {
          uniqueSources.add(entry.title);
          
          // Create a search URL for this document
          const searchQuery = encodeURIComponent(entry.title);
          const searchUrl = `${baseUrl}/?q=${searchQuery}`;
          
          // Slack uses <url|text> format for clickable links in mrkdwn
          sourcesText += `• <${searchUrl}|${entry.title}>\n`;
          sourceCount++;
        }
      });
      
      // If we have sources, add them as a section
      if (uniqueSources.size > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: sourcesText
          }
        });
      }
    }

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