/**
 * Slack webhook handler for Cloudflare Workers
 * Handles slash commands directly without Socket Mode
 */

import { searchChunks } from './lib/content-manager';
import { formatSourceReference } from './lib/source-formatter';

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

export async function handleSlackCommand(request: Request, env: any): Promise<Response> {
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

  // Validate it's the expected command
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
                  `• \`${command.command} breakpoints\` - Search for breakpoints\n` +
                  `• \`${command.command} typography spacing\` - Search for typography and spacing\n` +
                  `• \`${command.command} switches\` - Learn about switches`
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

  // Send immediate response
  setTimeout(async () => {
    await searchAndRespond(command, env);
  }, 0);

  return new Response(JSON.stringify(immediateResponse), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function searchAndRespond(command: SlackSlashCommand, env: any) {
  try {
    // Search the documentation
    const results = searchChunks(command.text, 5);
    
    let blocks: SlackBlock[] = [];
    
    if (results.length === 0) {
      blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔍 No documentation found matching *"${command.text}"*\n\nTry:\n• Using different keywords\n• Checking spelling\n• Being more specific`
          }
        }
      ];
    } else {
      // Header
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📚 CanvasKit Documentation',
          emoji: true
        }
      });

      // Context
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Found ${results.length} result${results.length === 1 ? '' : 's'} for *"${command.text}"*`
          }
        ]
      });

      blocks.push({ type: 'divider' });

      // Add results
      results.slice(0, 3).forEach((result, index) => {
        const { displayName, url } = formatSourceReference(result.entry);
        
        // Clean up chunk text
        const cleanText = result.chunk.text
          .replace(/^[\-\*•]\s*/gm, '')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^#+\s*/gm, '')
          .trim();
        
        const truncated = cleanText.length > 200 
          ? cleanText.substring(0, 197) + '...'
          : cleanText;

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${index + 1}. ${result.entry.title}*\n${truncated}`
          },
          accessory: (url && /^https?:\/\//i.test(url)) ? {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Source'
            },
            url: url,
            action_id: `view_source_${index}`
          } : undefined
        });

        if (index < Math.min(results.length - 1, 2)) {
          blocks.push({ type: 'divider' });
        }
      });

      // Footer
      if (results.length > 3) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Showing top 3 of ${results.length} results_`
            }
          ]
        });
      }
    }

    // Send the follow-up message
    await fetch(command.response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        blocks,
        text: results.length > 0 
          ? `Found ${results.length} result${results.length === 1 ? '' : 's'} for "${command.text}"`
          : `No results found for "${command.text}"`
      })
    });
  } catch (error) {
    console.error('Error processing Slack command:', error);
    
    // Send error message
    await fetch(command.response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ Sorry, an error occurred while searching. Please try again.'
      })
    });
  }
}
