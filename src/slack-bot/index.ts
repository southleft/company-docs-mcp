import { App, SlashCommand } from '@slack/bolt';
import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

interface SearchResult {
  title: string;
  content: string;
  source: string;
  relevance: number;
}

interface MCPResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

class DocumentationBot {
  private app: App;
  private mcpEndpoint: string;

  constructor() {
    this.app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true, // Enable Socket Mode for local development
    });

    // Use local MCP endpoint by default, or Cloudflare Worker if deployed
    this.mcpEndpoint = process.env.MCP_ENDPOINT || 
      (process.env.WORKER_NAME ? 
        `https://${process.env.WORKER_NAME}.workers.dev` : 
        'http://localhost:3000');

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle slash command
    this.app.command(process.env.SLACK_SLASH_COMMAND || '/docs', async ({ command, ack, respond }) => {
      await ack();
      
      if (!command.text) {
        await respond({
          text: '❓ Please provide a search query. Example: `/docs how to authenticate API`'
        });
        return;
      }

      await respond({
        text: `🔍 Searching for: "${command.text}"...`
      });

      try {
        const results = await this.searchDocumentation(command.text);
        const response = this.formatSlackResponse(results, command.text);
        await respond(response);
      } catch (error) {
        console.error('Search error:', error);
        await respond({
          text: '❌ Sorry, an error occurred while searching. Please try again.'
        });
      }
    });

    // Handle app mentions
    this.app.event('app_mention', async ({ event, say }) => {
      // Extract the query by removing the bot mention
      const query = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
      
      if (!query) {
        await say('👋 Hi! Ask me about your documentation. For example: "How do I set up authentication?"');
        return;
      }

      try {
        const results = await this.searchDocumentation(query);
        const response = this.formatSlackResponse(results, query);
        await say(response);
      } catch (error) {
        console.error('Search error:', error);
        await say('❌ Sorry, an error occurred while searching. Please try again.');
      }
    });

    // Handle direct messages
    this.app.message(async ({ message, say }) => {
      // Only respond to DMs (not in channels)
      if (message.channel_type === 'im' && message.text) {
        try {
          const results = await this.searchDocumentation(message.text);
          const response = this.formatSlackResponse(results, message.text);
          await say(response);
        } catch (error) {
          console.error('Search error:', error);
          await say('❌ Sorry, an error occurred while searching. Please try again.');
        }
      }
    });
  }

  private async searchDocumentation(query: string): Promise<MCPResponse> {
    const response = await fetch(`${this.mcpEndpoint}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 5,
        includeContent: true
      })
    });

    if (!response.ok) {
      throw new Error(`MCP search failed: ${response.statusText}`);
    }

    return await response.json() as MCPResponse;
  }

  private formatSlackResponse(results: MCPResponse, query: string): any {
    if (results.results.length === 0) {
      return {
        text: `No results found for "${query}"`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔍 No documentation found matching *"${query}"*\n\nTry:\n• Using different keywords\n• Checking spelling\n• Being more specific`
            }
          }
        ]
      };
    }

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📚 Documentation Search Results`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Found ${results.total} result${results.total === 1 ? '' : 's'} for *"${query}"*`
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    // Add top results
    results.results.slice(0, 3).forEach((result, index) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${index + 1}. ${result.title}*\n${this.truncateText(result.content, 200)}`
        },
        accessory: result.source ? {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Source'
          },
          url: result.source,
          action_id: `view_source_${index}`
        } : undefined
      });

      if (index < results.results.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });

    // Add footer with tips
    if (results.total > 3) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Showing top 3 of ${results.total} results. Try a more specific query for better results._`
          }
        ]
      });
    }

    return {
      text: `Found ${results.total} result${results.total === 1 ? '' : 's'} for "${query}"`,
      blocks
    };
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to break at a sentence
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastPeriod > maxLength - 50) {
      return truncated.substring(0, lastPeriod + 1);
    }
    
    return truncated.substring(0, lastSpace) + '...';
  }

  async start() {
    try {
      await this.app.start();
      console.log('⚡️ Documentation bot is running!');
      console.log(`📡 Connected to MCP endpoint: ${this.mcpEndpoint}`);
      console.log(`💬 Slash command: ${process.env.SLACK_SLASH_COMMAND || '/docs'}`);
    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot
const bot = new DocumentationBot();
bot.start();