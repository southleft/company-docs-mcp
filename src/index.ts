import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	loadEntries,
	searchEntries as searchEntriesLocal,
	getEntriesByCategory,
	getAllTags,
	getEntryById,
	SAMPLE_ENTRIES
} from "./lib/content-manager";
import { searchChunksEnhanced as searchChunks } from "./lib/content-manager-enhanced";
import { searchWithSupabase as searchEntries } from "./lib/search-handler";
import { formatSourceReference, formatInlineCitation } from "./lib/source-formatter";
import { Category, ContentEntry } from "./lib/content";
import { handleSlackCommand } from "./slack-webhook";

// OpenAI integration
import { OpenAI } from "openai";

// Load content from actual JSON files (same approach for local and production)
console.log('🔄 Loading content from JSON files...');

async function loadActualContent() {
	try {
		// Load content dynamically using manifest file
		const { loadAllContentEntries } = await import('./lib/content-loader');
		const actualEntries = await loadAllContentEntries();

		if (actualEntries.length > 0) {
			loadEntries(actualEntries);

			console.log(`✅ Loaded ${actualEntries.length} content entries dynamically`);
			console.log(`📚 Entries: ${actualEntries.map((e: ContentEntry) => e.title).join(', ')}`);

			// Log some chunks to verify content is loaded
			const totalChunks = actualEntries.reduce((sum: number, entry: ContentEntry) => sum + (entry.chunks?.length || 0), 0);
			console.log(`📄 Total chunks loaded: ${totalChunks}`);

			// Log tags for verification
			const tags = getAllTags();
			console.log(`🏷️  Available tags: ${tags.length} total`);

			return true;
		} else {
			throw new Error('No content entries loaded from manifest');
		}
	} catch (error) {
		console.error('❌ Failed to load content dynamically:', error);
		console.error('Error details:', error instanceof Error ? error.message : String(error));

		// Fallback to sample entries
		console.log('🔄 Loading fallback sample content...');
		loadEntries(SAMPLE_ENTRIES);
		console.warn('⚠️  Using fallback sample content');
		return false;
	}
}

// Content will be loaded lazily when first tool is called
let contentLoaded = false;

async function ensureContentLoaded() {
	if (!contentLoaded) {
		console.log('🔄 Loading content lazily...');
		await loadActualContent();
		contentLoaded = true;
		console.log('✅ Content loaded successfully');
	}
}

// Utility function to detect resource limit errors
function isResourceLimitError(error: any): boolean {
	const errorMessage = error?.message?.toLowerCase() || '';
	const errorStack = error?.stack?.toLowerCase() || '';

	// Common patterns indicating resource limits
	const resourceLimitPatterns = [
		'exceeded',
		'resource limit',
		'cpu time limit',
		'memory limit',
		'execution time',
		'timeout',
		'worker exceeded',
		'script execution time',
		'memory usage',
		'out of memory',
		'maximum execution time'
	];

	return resourceLimitPatterns.some(pattern =>
		errorMessage.includes(pattern) || errorStack.includes(pattern)
	);
}

// Utility function to create a helpful resource limit error message
function createResourceLimitErrorMessage(): string {
	return `🚫 **Cloudflare Worker Resource Limit Exceeded**

The MCP server has hit Cloudflare Workers resource limits (CPU time, memory, or execution time). This is unusual on the paid plan but can happen with:

• Extremely complex queries requiring extensive processing
• Multiple concurrent requests
• Very large search operations

**Immediate Solutions:**
1. Try breaking complex questions into smaller parts
2. Wait a moment and retry your request
3. Contact the administrator if this persists

**Technical Details:**
• Current setup: Paid plan with enhanced resources (50ms CPU time)
• Full knowledge base: Active (113 entries + 2192 chunks)
• Optimization: Paid plan optimized for comprehensive responses

This is a rare occurrence on the paid tier - please retry your request.`;
}

// AI System Prompt - will be initialized with env variables
let AI_SYSTEM_PROMPT = `You are a documentation assistant.

MANDATORY SEARCH REQUIREMENT:
You MUST call the search_design_knowledge function for EVERY single user question - no exceptions.
- For questions about "what's available" or "what documentation exists", search for: "overview getting started"
- For questions about tokens, search for: "tokens"
- For questions about theming, search for: "theming"
- For any other question, search using relevant keywords from the question

CRITICAL WORKFLOW:
1. User asks question → You MUST call search_design_knowledge
2. Get search results → Analyze the returned documentation
3. Provide answer based ONLY on search results
4. NEVER answer from your training data - ALWAYS search first

RESPONSE FORMAT:
- Provide COMPREHENSIVE and DETAILED answers based on ALL search results
- Include ALL relevant information from the documentation - don't summarize or shorten
- Include specific details, code examples, and implementation guidelines
- When multiple relevant results are found, include information from ALL of them
- Cite source documents naturally in your response
- Aim for thorough, complete responses that fully address the user's question

If search returns no results, simply state that the information is not available in the documentation.`;

// Available MCP tools for the AI
const MCP_TOOLS = [
	{
		type: "function",
		function: {
			name: "search_design_knowledge",
			description: "ALWAYS USE THIS FIRST - Primary search tool for ALL questions about the knowledge base. Use for tokens, theming, components, patterns, getting started, overview, or ANY other topic.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search query - for broad questions use 'overview' or 'getting started'"
					},
					category: {
						type: "string",
						description: "Filter by category (optional)"
					},
					limit: {
						type: "number",
						description: "Maximum number of results (default: 25)"
					}
				},
				required: ["query"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "search_documentation",
			description: "Alternative search tool if search_design_knowledge doesn't find results",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search query for documentation"
					},
					category: {
						type: "string",
						description: "Filter by category (optional) - can be: components, tokens, patterns, workflows, guidelines, or general"
					},
					limit: {
						type: "number",
						description: "Maximum number of results (default: 20, paid plan optimized)"
					}
				},
				required: ["query"]
			}
		}
	},
	{
		type: "function",
		function: {
			name: "search_chunks",
			description: "Search for specific detailed information in content chunks",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search query for specific information"
					},
					limit: {
						type: "number",
						description: "Maximum number of chunks (default: 12, paid plan optimized)"
					}
				},
				required: ["query"]
			}
		}
	}
];

// Function to call MCP tools
async function callMcpTool(toolName: string, args: any, env?: any): Promise<string> {
	// Ensure content is loaded before any tool call
	await ensureContentLoaded();

	switch (toolName) {
		case "search_documentation":
		case "search_design_knowledge":
			// Add timeout to search operations (10 seconds)
			const searchResults = await withTimeout(
				searchEntries({
					query: args.query,
					category: args.category as Category | undefined,
					limit: args.limit || 50,  // Increased default to get more results
				}, env),
				10000,
				'Design knowledge search'
			);

			console.log(`[Search Debug] search_documentation called with query: "${args.query}"`);
			console.log(`[Search Debug] Found ${searchResults.length} results`);
			if (searchResults.length > 0) {
				console.log(`[Search Debug] First result title: ${searchResults[0].title}`);
			}

			if (searchResults.length === 0) {
				return "No design system knowledge found matching your search criteria.";
			}

			const formattedResults = searchResults.map((entry, index) =>
				`**🔍 ${index + 1}. ${entry.title}**

📂 Category: ${entry.metadata.category}
🏷️ System: ${entry.metadata.system || "N/A"}
🔖 Tags: ${entry.metadata.tags.join(", ")}
⭐ Confidence: ${entry.metadata.confidence}
🔗 Source: [${entry.source?.location || "Link"}](${entry.source?.location || entry.metadata?.source_url || "#"})

${entry.content.slice(0, 10000)}${entry.content.length > 10000 ? "..." : ""}  // Increased to 10K chars per result

---`
			).join("\n\n");

			return `FOUND ${searchResults.length} RESULT${searchResults.length === 1 ? "" : "S"}:

${formattedResults}`;

		case "search_chunks":
			const chunkResults = searchChunks(args.query, args.limit || 12, {
				enableDiversity: true,
				maxPerSource: 2,
				preferUrls: true,
				logDiversity: false
			});

			console.log(`[Search Debug] Query: "${args.query}", Results: ${chunkResults.length}`);
			if (chunkResults.length > 0) {
				console.log(`[Search Debug] First result: ${chunkResults[0].entry.title}`);
			}

			if (chunkResults.length === 0) {
				return "No specific information found matching your query.";
			}

			const formattedChunks = chunkResults.map((result, index) => {
				const { displayName, url } = formatSourceReference(result.entry);
				const sourceLink = url
					? `[${displayName}](${url})`
					: displayName;

				// Clean up the chunk text to avoid nested bullets
				const cleanText = result.chunk.text
					.replace(/^[\-\*•]\s*/gm, '') // Remove bullet points
					.replace(/\n{3,}/g, '\n\n') // Normalize line breaks
					.trim();

				return `**${result.chunk.metadata?.section || "Insight"}** from ${sourceLink}

${cleanText}`;
			}).join("\n\n---\n\n");

			return `FOUND ${chunkResults.length} RELEVANT CHUNK${chunkResults.length === 1 ? "" : "S"}:

${formattedChunks}`;

		case "browse_by_category":
			const categoryEntries = getEntriesByCategory(args.category as Category);

			if (categoryEntries.length === 0) {
				return `No entries found in category: ${args.category}`;
			}

			const formattedEntries = categoryEntries.map(entry =>
				`**${entry.title}**
Tags: ${entry.metadata.tags.join(", ")}
System: ${entry.metadata.system || "N/A"}`
			).join("\n\n");

			return `${categoryEntries.length} ENTR${categoryEntries.length === 1 ? "Y" : "IES"} IN "${args.category.toUpperCase()}":

${formattedEntries}`;

		case "get_all_tags":
			const tags = getAllTags();
			return `AVAILABLE TAGS (${tags.length}): ${tags.join(", ")}`;



		default:
			throw new Error(`Unknown tool: ${toolName}`);
	}
}

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

// AI Chat Handler
async function handleAiChat(request: Request, env: any): Promise<Response> {
	// Request-level timeout for Cloudflare Workers (25 seconds to leave buffer)
	return withTimeout(
		handleAiChatInternal(request, env),
		25000,
		'AI chat request'
	).catch(error => {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if (error.message.includes('timed out')) {
			return new Response(JSON.stringify({
				error: `⏱️ **Request Timeout**\n\nYour request took longer than expected (>45 seconds). This can happen with complex queries or when external services are slow.\n\n**Try:**\n• Breaking your question into smaller parts\n• Asking more specific questions\n• Waiting a moment and trying again\n\nIf this persists, the issue may be with external API services.`
			}), {
				status: 408,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}

		// Re-throw other errors to be handled by main error handler
		throw error;
	});
}

async function handleAiChatInternal(request: Request, env: any): Promise<Response> {
	try {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		const { message } = await request.json() as any;

		// Get OpenAI config from environment variables
		const apiKey = env?.OPENAI_API_KEY;
		let model = env?.OPENAI_MODEL || "gpt-4o";

		// Validate model name (include GPT-5 models)
		const validModels = ['gpt-5-nano', 'gpt-5', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
		// Only warn if model doesn't match any known pattern
		if (!validModels.some(m => model.includes(m)) && !model.includes('gpt')) {
			console.warn(`[AI Chat] Unknown model "${model}" specified, proceeding anyway`);
		}

		// Log the model being used (only in development)
		if (env?.LOG_SEARCH_PERFORMANCE === 'true') {
			console.log(`[AI Chat] Using OpenAI model: ${model}`);
		}

		if (!apiKey) {
			return new Response(JSON.stringify({
				error: "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
			}), {
				status: 400,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}

		// Initialize OpenAI with timeout configuration
		const openai = new OpenAI({
			apiKey: apiKey,
			timeout: 45000, // 45-second timeout for OpenAI client (increased for complex theming queries)
			maxRetries: 1, // Reduce retries to prevent long waits
		});

		// Create the chat completion with tool calling
		let completion;
		try {
			// Use appropriate parameter based on model type
			const completionParams: any = {
				model: model,
				messages: [
					{
						role: "system",
						content: AI_SYSTEM_PROMPT
					},
					{
						role: "user",
						content: message
					}
				],
				tools: MCP_TOOLS,
				tool_choice: "required",  // Force the AI to use tools
				parallel_tool_calls: false,  // Ensure sequential tool calls for gpt-4o
				stream: false // Disable streaming for more predictable performance
			};

			// GPT-5 models use max_completion_tokens instead of max_tokens
			if (model.includes('gpt-5')) {
				completionParams.max_completion_tokens = 4000;
			} else {
				completionParams.max_tokens = 8000;  // Increased for more comprehensive responses
			}

			// Wrap OpenAI call with timeout (35 seconds for initial completion, increased for theming queries)
			completion = await withTimeout(
				openai.chat.completions.create(completionParams),
				35000,
				'OpenAI initial completion'
			);
		} catch (openaiError: any) {
			console.error("OpenAI API Error Details:", openaiError);
			// Re-throw with more context
			const errorDetails = openaiError.response?.data?.error || openaiError;
			throw new Error(`OpenAI API failed: ${errorDetails.message || openaiError.message || 'Unknown error'}`);
		}

		let response = completion.choices[0].message;
		console.log('[AI Debug] Initial response has content:', !!response.content, 'Length:', response.content?.length || 0);
		console.log('[AI Debug] Initial response content preview:', response.content?.substring(0, 100));

		// Only validate content if there are no tool calls
		// When OpenAI makes tool calls, response.content is intentionally empty
		if ((!response || !response.content) && (!response.tool_calls || response.tool_calls.length === 0)) {
			console.error('[ERROR] OpenAI returned no content and no tool calls');
			throw new Error('OpenAI returned an empty response. Please try rephrasing your question.');
		}

		// Handle tool calls - MUST have tool calls with forced tool_choice
		console.log('[AI Debug] Tool calls:', response.tool_calls?.length || 0);
		if (!response.tool_calls || response.tool_calls.length === 0) {
			console.error('[ERROR] AI did not use search_design_knowledge tool despite explicit requirement');
			// Force a search by calling the tool ourselves
			let searchQuery = message.toLowerCase();
			
			// Determine appropriate search query based on user message
			if (searchQuery.includes('available') || searchQuery.includes('documentation')) {
				searchQuery = 'overview getting started documentation';
			} else if (searchQuery.includes('token')) {
				searchQuery = 'tokens design tokens theming';
			} else if (searchQuery.includes('theme') || searchQuery.includes('theming')) {
				searchQuery = 'theming tokens styles';
			} else if (searchQuery.includes('component')) {
				searchQuery = 'components ui elements';
			} else {
				// Use the original message as the search query
				searchQuery = message;
			}
			
			console.log('[Fallback] Forcing search with query:', searchQuery);
			const searchResult = await callMcpTool('search_design_knowledge', { 
				query: searchQuery,
				limit: 30 
			}, env);
			
			// Parse the search result and format a proper response
			if (searchResult && searchResult !== 'No results found.') {
				const formattedResponse = `Based on the documentation:\n\n${searchResult}`;
				return new Response(JSON.stringify({
					response: formattedResponse
				}), {
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			} else {
				return new Response(JSON.stringify({
					response: 'I could not find specific information about that topic in the documentation. Please try rephrasing your question or ask about components, tokens, theming, or other design system features.'
				}), {
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}
		}
		
		if (response.tool_calls && response.tool_calls.length > 0) {
			console.log('[AI Debug] Tools being called:', response.tool_calls.map(tc => tc.function.name));
			const messages: any[] = [
				{
					role: "system",
					content: AI_SYSTEM_PROMPT
				},
				{
					role: "user",
					content: message
				},
				response
			];

			// Execute each tool call with timeout
			for (const toolCall of response.tool_calls) {
				try {
					// Add timeout to tool calls (10 seconds each)
					const toolResult = await withTimeout(
						callMcpTool(
							toolCall.function.name,
							JSON.parse(toolCall.function.arguments),
							env
						),
						10000,
						`Tool call: ${toolCall.function.name}`
					);

					messages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: toolResult // Now it's a string, not JSON
					});
				} catch (error: any) {
					// Provide more specific error messages for timeouts
					let errorMessage = error.message;
					if (error.message.includes('timed out')) {
						errorMessage = `Tool operation timed out. This can happen with complex searches or when external services are slow. The search may still be partially successful.`;
					}

					messages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: `Error: ${errorMessage}`
					});
				}
			}

			// Get final response with tool results
			try {
				const finalParams: any = {
					model: model,
					messages: messages,
					stream: false // Disable streaming for more predictable performance
				};

				// GPT-5 models use max_completion_tokens instead of max_tokens
				if (model.includes('gpt-5')) {
					finalParams.max_completion_tokens = 4000;
				} else {
					finalParams.max_tokens = 8000;  // Increased for more comprehensive responses
				}

				// Add timeout to final completion (30 seconds, increased for theming queries)
				const finalCompletion = await withTimeout(
					openai.chat.completions.create(finalParams),
					30000,
					'OpenAI final completion'
				);

				response = finalCompletion.choices[0].message;
				console.log('[AI Debug] Final response content length:', response.content?.length || 0);
				console.log('[AI Debug] Final response preview:', response.content?.substring(0, 100));

				// Validate final response
				if (!response || !response.content) {
					console.error('[ERROR] Final OpenAI returned no content');
					throw new Error('OpenAI returned an empty response after tool execution. Please try again.');
				}
			} catch (openaiError: any) {
				console.error("OpenAI Final Completion Error:", openaiError);
				const errorDetails = openaiError.response?.data?.error || openaiError;
				throw new Error(`OpenAI API failed on final response: ${errorDetails.message || openaiError.message || 'Unknown error'}`);
			}
		}

		// Clean up response to remove unwanted sections
		let cleanedResponse = response.content || '';

		// Remove "From the Knowledge Base" section header and just keep the content
		cleanedResponse = cleanedResponse.replace(/##\s*📚\s*From the Knowledge Base\s*\n+/gi, '');

		// Remove entire "From General Knowledge" section
		cleanedResponse = cleanedResponse.replace(/##\s*🧠\s*From General Knowledge[\s\S]*/gi, '');

		// Also remove variations without emojis
		cleanedResponse = cleanedResponse.replace(/##\s*From the Knowledge Base\s*\n+/gi, '');
		cleanedResponse = cleanedResponse.replace(/##\s*From General Knowledge[\s\S]*/gi, '');

		// Trim any extra whitespace
		cleanedResponse = cleanedResponse.trim();

		return new Response(JSON.stringify({
			response: cleanedResponse
		}), {
			headers: { ...corsHeaders, "Content-Type": "application/json" }
		});

	} catch (error: any) {
		console.error("AI Chat Error:", error);

		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if (isResourceLimitError(error)) {
			return new Response(JSON.stringify({
				error: createResourceLimitErrorMessage()
			}), {
				status: 503,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}

		// Handle specific OpenAI errors
		let errorMessage = "An error occurred while processing your request";
		let statusCode = 500;

		if (error.message?.includes("401") || error.message?.includes("Incorrect API key")) {
			errorMessage = "OpenAI API authentication failed. Please check that the API key is valid and has not expired.";
			statusCode = 401;
		} else if (error.message?.includes("429") || error.message?.includes("Rate limit")) {
			errorMessage = "OpenAI API rate limit exceeded. Please try again in a few moments.";
			statusCode = 429;
		} else if (error.message?.includes("model") || error.message?.includes("does not exist")) {
			errorMessage = `OpenAI model error: The specified model may not be available. Error: ${error.message}`;
			statusCode = 400;
		} else if (error.message) {
			errorMessage = `OpenAI API error: ${error.message}`;
		}

		return new Response(JSON.stringify({
			error: errorMessage
		}), {
			status: statusCode,
			headers: { ...corsHeaders, "Content-Type": "application/json" }
		});
	}
}

// Create MCP server instance - will be initialized in handler
let server: any = null;

// Function to initialize MCP tools
function initializeMcpTools(server: any) {
	// Initialize MCP tools
	server.tool(
		"search_design_knowledge",
	{
		query: z.string().describe("Search query for design system knowledge"),
		category: z.string()
			.optional()
			.describe("Filter by category"),
		tags: z.array(z.string()).optional().describe("Filter by tags"),
		limit: z.number().min(1).max(50).default(25).describe("Maximum number of results"),
	},
	async ({ query, category, tags, limit }) => {
		// Note: MCP tools don't have access to env, so they can't use Supabase
		// This will always use local search
		const results = await searchEntries({
			query,
			category: category as Category | undefined,
			tags,
			limit,
		});

		if (results.length === 0) {
			return {
				content: [{
					type: "text",
					text: "No documentation found matching your search criteria."
				}],
			};
		}

		const formattedResults = results.map((entry, index) =>
			`<strong>🔍 ${index + 1}. ${entry.title}</strong>

<em>📂 Category:</em> ${entry.metadata.category}
<em>🏷️ System:</em> ${entry.metadata.system || "N/A"}
<em>🔖 Tags:</em> ${entry.metadata.tags.join(", ")}
<em>⭐ Confidence:</em> ${entry.metadata.confidence}
<em>🔗 Source:</em> <a href="${entry.source?.location || entry.metadata?.source_url || "#"}" target="_blank">${entry.source?.location || entry.metadata?.source_url || "N/A"}</a>

${entry.content.slice(0, 10000)}${entry.content.length > 10000 ? "..." : ""}  // Increased to 10K chars per result

<hr style="border: none; border-top: 1px solid #373a40; margin: 16px 0;">`
		).join("\n\n");

		return {
			content: [{
				type: "text",
				text: `<strong>🔍 FOUND ${results.length} RESULT${results.length === 1 ? "" : "S"}</strong>

${formattedResults}`
			}],
		};
	}
);

// Tool: Search chunks for specific information
server.tool(
	"search_chunks",
	{
		query: z.string().describe("Search query for specific information"),
		limit: z.number().min(1).max(20).default(8).describe("Maximum number of chunks"),
	},
	async ({ query, limit }) => {
		const results = await searchChunks(query, limit, {
			enableDiversity: true,
			maxPerSource: 2,
			preferUrls: true,
			logDiversity: false
		});

		if (results.length === 0) {
			return {
				content: [{
					type: "text",
					text: "No specific information found matching your query."
				}],
			};
		}

		const formattedChunks = results.map((result, index) => {
			const { displayName, url } = formatSourceReference(result.entry);
			const sourceLink = url
				? `<a href="${url}" target="_blank">${displayName}</a>`
				: displayName;

			// Clean up the chunk text to avoid nested bullets
			const cleanText = result.chunk.text
				.replace(/^[\-\*•]\s*/gm, '') // Remove bullet points
				.replace(/\n{3,}/g, '\n\n') // Normalize line breaks
				.replace(/^\s+|\s+$/gm, '') // Trim each line
				.trim();

			return `<div style="margin-bottom: 20px; padding: 16px; background: #2c2e33; border-radius: 8px; border-left: 3px solid #339af0;">
<strong style="color: #339af0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${result.chunk.metadata?.section || "Insight"}</strong> <span style="color: #909296; font-size: 14px;">from ${sourceLink}</span>

<div style="margin-top: 12px; line-height: 1.6; color: #c1c2c5;">${cleanText}</div>
</div>`;
		}).join("\n");

		return {
			content: [{
				type: "text",
				text: `<strong>🎯 FOUND ${results.length} RELEVANT CHUNK${results.length === 1 ? "" : "S"}</strong>

${formattedChunks}`
			}],
		};
	}
);

// Tool: Browse by category
server.tool(
	"browse_by_category",
	{
		category: z.string()
			.describe("Category to browse"),
	},
	async ({ category }) => {
		const entries = getEntriesByCategory(category as Category);

		if (entries.length === 0) {
			return {
				content: [{
					type: "text",
					text: `No entries found in category: ${category}`
				}],
			};
		}

		const formattedEntries = entries.map(entry =>
			`**${entry.title}**
Tags: ${entry.metadata.tags.join(", ")}
System: ${entry.metadata.system || "N/A"}`
		).join("\n\n");

		return {
			content: [{
				type: "text",
				text: `<strong>📁 ${entries.length} ENTR${entries.length === 1 ? "Y" : "IES"} IN "${category.toUpperCase()}"</strong>

${formattedEntries}`
			}],
		};
	}
);

// Tool: Get all tags
server.tool(
	"get_all_tags",
	{},
	async () => {
		const tags = getAllTags();

		return {
			content: [{
				type: "text",
				text: `<strong>🏷️ AVAILABLE TAGS (${tags.length})</strong>

${tags.map(tag => `<span style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; margin: 2px;">🔖 ${tag}</span>`).join(" ")}`
			}],
		};
	}
);
} // End of initializeMcpTools function

// Simple request handler with timeout
async function handleMcpRequest(request: Request, env?: Env): Promise<Response> {
	// Add 20-second timeout to MCP requests
	return withTimeout(
		handleMcpRequestInternal(request, env),
		20000,
		'MCP request'
	).catch(error => {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if (error.message.includes('timed out')) {
			return new Response(JSON.stringify({
				jsonrpc: "2.0",
				id: null,
				error: {
					code: -32603,
					message: `Request timeout: The operation took longer than expected (>20 seconds). This can happen with complex searches or when external services are slow. Please try a more specific query or try again later.`
				}
			}), {
				status: 408,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}

		// Re-throw other errors to be handled by main error handler
		throw error;
	});
}

async function handleMcpRequestInternal(request: Request, env?: Env): Promise<Response> {
	try {
		// Add CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Accept",
			"Access-Control-Expose-Headers": "Content-Type",
		};

		// Handle OPTIONS request
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// Only handle POST requests for MCP
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		// Check if client wants SSE format (for remote MCP clients like Claude Desktop)
		const acceptHeader = request.headers.get('accept') || '';
		const wantsSSE = acceptHeader.includes('text/event-stream');

		const body = await request.json() as any;

		// Helper function to format response based on client preference
		function formatResponse(data: any, isSSE: boolean = wantsSSE): Response {
			if (isSSE) {
				// Format as Server-Sent Events for remote MCP clients
				const sseData = `event: message\ndata: ${JSON.stringify(data)}\n\n`;
				return new Response(sseData, {
					headers: {
						...corsHeaders,
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						"Connection": "keep-alive"
					}
				});
			} else {
				// Standard JSON response
				return new Response(JSON.stringify(data), {
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}
		}

		// Handle MCP JSON-RPC request
		if (body.method === "initialize") {
			// Handle MCP initialization
			return formatResponse({
				jsonrpc: "2.0",
				id: body.id,
				result: {
					protocolVersion: "2024-11-05",
					capabilities: {
						tools: {},
						resources: {},
						prompts: {}
					},
					serverInfo: {
						name: `${env?.ORGANIZATION_NAME || 'Organization'} Documentation`,
						version: "1.0.0"
					}
				}
			});
		}

		if (body.method === "notifications/initialized") {
			// Handle MCP initialized notification (doesn't need a response)
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		if (body.method === "ping") {
			// Handle ping requests
			return formatResponse({
				jsonrpc: "2.0",
				id: body.id,
				result: {}
			});
		}

		if (body.method === "tools/list") {
			// Return list of available tools
			const tools = [
				{
					name: "search_design_knowledge",
					description: "Search through design system knowledge base entries by query, category, or tags. Use this as the primary tool for finding information about specific topics like tokens, theming, components, patterns, etc.",
					inputSchema: {
						type: "object",
						properties: {
							query: {
								type: "string",
								description: "Search query for finding relevant design system knowledge"
							},
							category: {
								type: "string",
								description: "Filter by category (optional - only use actual content categories)",
								enum: ["documentation", "components", "guidelines", "patterns", "workflows"]
							},
							tags: {
								type: "array",
								items: { type: "string" },
								description: "Filter by specific tags"
							},
							limit: {
								type: "number",
								description: "Maximum number of results to return (default: 15)",
								default: 15
							}
						},
						required: ["query"]
					}
				},
				{
					name: "search_chunks",
					description: "Search through specific content chunks for detailed information",
					inputSchema: {
						type: "object",
						properties: {
							query: {
								type: "string",
								description: "Search query for finding specific content chunks"
							},
							limit: {
								type: "number",
								description: "Maximum number of chunks to return (default: 8)",
								default: 8
							}
						},
						required: ["query"]
					}
				},
				{
					name: "browse_by_category",
					description: "Browse all entries in a specific category (use search_documentation for finding specific topics like tokens, themes, etc.)",
					inputSchema: {
						type: "object",
						properties: {
							category: {
								type: "string",
								description: "Category to browse - only use actual content categories",
								enum: ["documentation", "components", "guidelines", "patterns", "workflows"]
							}
						},
						required: ["category"]
					}
				},
				{
					name: "get_all_tags",
					description: "Get a list of all available tags in the knowledge base",
					inputSchema: {
						type: "object",
						properties: {},
						additionalProperties: false
					}
				}
			];

			return formatResponse({
				jsonrpc: "2.0",
				id: body.id,
				result: { tools }
			});
		}

		if (body.method === "tools/call") {
			// Ensure content is loaded before any tool call
			await ensureContentLoaded();

			const toolName = body.params?.name;
			const args = body.params?.arguments || {};

			let result;

			switch (toolName) {
				case "search_design_knowledge":
					console.log('[Search API] Searching with args:', {
						query: args.query,
						category: args.category,
						tags: args.tags,
						limit: args.limit || 25,
						timestamp: new Date().toISOString()
					});

					// Add timeout to search operations (12 seconds)
					const searchResults = await withTimeout(
						searchEntries({
							query: args.query,
							category: args.category,
							tags: args.tags,
							limit: args.limit || 25,
						}, env),
						12000,
						'Design knowledge search'
					);

					console.log('[Search API] Search completed:', {
						resultsFound: searchResults.length,
						resultTitles: searchResults.slice(0, 3).map(r => r.title),
						timestamp: new Date().toISOString()
					});

					if (searchResults.length === 0) {
						result = {
							content: [{
								type: "text",
								text: "No documentation found matching your search criteria."
							}],
						};
					} else {
						const formattedResults = searchResults.map((entry, index) =>
							`<strong>🔍 ${index + 1}. ${entry.title}</strong>

<em>📂 Category:</em> ${entry.metadata.category}
<em>🏷️ System:</em> ${entry.metadata.system || "N/A"}
<em>🔖 Tags:</em> ${entry.metadata.tags.join(", ")}
<em>⭐ Confidence:</em> ${entry.metadata.confidence}
<em>🔗 Source:</em> <a href="${entry.source?.location || entry.metadata?.source_url || "#"}" target="_blank">${entry.source?.location || entry.metadata?.source_url || "N/A"}</a>

${entry.content.slice(0, 10000)}${entry.content.length > 10000 ? "..." : ""}  // Increased to 10K chars per result

<hr style="border: none; border-top: 1px solid #373a40; margin: 16px 0;">`
						).join("\n\n");

						result = {
							content: [{
								type: "text",
								text: `<strong>🔍 FOUND ${searchResults.length} RESULT${searchResults.length === 1 ? "" : "S"}</strong>

${formattedResults}`
							}],
						};
					}
					break;

				case "search_chunks":
					const chunkResults = searchChunks(args.query, args.limit || 8, {
						enableDiversity: true,
						maxPerSource: 2,
						preferUrls: true,
						logDiversity: false
					});

					if (chunkResults.length === 0) {
						result = {
							content: [{
								type: "text",
								text: "No specific information found matching your query."
							}],
						};
					} else {
						const formattedChunks = chunkResults.map((result, index) => {
							const { displayName, url } = formatSourceReference(result.entry);
							const sourceLink = url
								? `<a href="${url}" target="_blank">${displayName}</a>`
								: displayName;

							// Clean up the chunk text to avoid nested bullets
							const cleanText = result.chunk.text
								.replace(/^[\-\*•]\s*/gm, '') // Remove bullet points
								.replace(/\n{3,}/g, '\n\n') // Normalize line breaks
								.trim();

							return `<div style="margin-bottom: 20px; padding: 16px; background: #2c2e33; border-radius: 8px; border-left: 3px solid #339af0;">
<strong style="color: #339af0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${result.chunk.metadata?.section || "Insight"}</strong> <span style="color: #909296; font-size: 14px;">from ${sourceLink}</span>

<div style="margin-top: 12px; line-height: 1.6; color: #c1c2c5;">${cleanText}</div>
</div>`;
						}).join("\n");

						result = {
							content: [{
								type: "text",
								text: `<strong>🎯 FOUND ${chunkResults.length} RELEVANT CHUNK${chunkResults.length === 1 ? "" : "S"}</strong>

${formattedChunks}`
							}],
						};
					}
					break;

				case "browse_by_category":
					const categoryEntries = getEntriesByCategory(args.category as Category);

					if (categoryEntries.length === 0) {
						result = {
							content: [{
								type: "text",
								text: `No entries found in category: ${args.category}`
							}],
						};
					} else {
						const formattedEntries = categoryEntries.map((entry, index) =>
							`<strong>📋 ${index + 1}. ${entry.title}</strong>
<em>🔖 Tags:</em> ${entry.metadata.tags.join(", ")}
<em>🏷️ System:</em> ${entry.metadata.system || "N/A"}`
						).join("\n\n");

						result = {
							content: [{
								type: "text",
								text: `<strong>📁 ${categoryEntries.length} ENTR${categoryEntries.length === 1 ? "Y" : "IES"} IN "${args.category.toUpperCase()}"</strong>

${formattedEntries}`
							}],
						};
					}
					break;

				case "get_all_tags":
					const tags = getAllTags();
					const tagList = tags.map(tag => `<span style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; margin: 2px;">🔖 ${tag}</span>`).join(" ");
					result = {
						content: [{
							type: "text",
							text: `<strong>🏷️ AVAILABLE TAGS (${tags.length})</strong>

${tagList}`
						}],
					};
					break;

				default:
					return formatResponse({
						jsonrpc: "2.0",
						id: body.id,
						error: {
							code: -32601,
							message: `Method not found: ${toolName}`
						}
					});
			}

			return formatResponse({
				jsonrpc: "2.0",
				id: body.id,
				result
			});
		}

		return formatResponse({
			jsonrpc: "2.0",
			id: body.id,
			error: {
				code: -32600,
				message: "Invalid Request"
			}
		});

	} catch (error: any) {
		console.error("MCP Request Error:", error);

		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		// Check if this is a resource limit error
		if (isResourceLimitError(error)) {
			return new Response(JSON.stringify({
				jsonrpc: "2.0",
				id: null,
				error: {
					code: -32603,
					message: "Resource limit exceeded: " + createResourceLimitErrorMessage()
				}
			}), {
				status: 503,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}

		return new Response(JSON.stringify({
			jsonrpc: "2.0",
			id: null,
			error: {
				code: -32603,
				message: "Internal error"
			}
		}), {
			status: 500,
			headers: { ...corsHeaders, "Content-Type": "application/json" }
		});
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// DON'T override the good system prompt - the one at line 120 is correct
		// This was causing the "I'll first perform a detailed search" issue
		/* COMMENTED OUT - BAD PROMPT THAT CAUSES ISSUES
		AI_SYSTEM_PROMPT = `You are a ${env.ORGANIZATION_NAME || 'documentation'} assistant.

When you receive a question, search the knowledge base using the available tools and provide a comprehensive, detailed answer. Aim to be thorough and informative - provide rich context, examples, best practices, and implementation details when relevant. Users are looking for in-depth expertise, not brief summaries.

Structure your response with these two sections:

1. "📚 From the Knowledge Base" section:
   - PUT HERE: Everything from search_chunks and search_documentation tools
   - PUT HERE: All content with citations
   - PUT HERE: All content with source links
   - NEVER PUT HERE: Your general AI knowledge

2. "🧠 From General Knowledge" section:
   - PUT HERE: Only your AI training data
   - PUT HERE: General best practices you know
   - NEVER PUT HERE: Any MCP search results
   - NEVER PUT HERE: Any citations or source links

IF YOU PUT CITATIONS IN GENERAL KNOWLEDGE, THE SYSTEM BREAKS.
IF YOU PUT MCP RESULTS IN GENERAL KNOWLEDGE, THE SYSTEM BREAKS.

⚠️⚠️⚠️ CRITICAL SECTION ASSIGNMENT ⚠️⚠️⚠️
• Knowledge Base section = MCP search results WITH citations
• General Knowledge section = Your AI training WITHOUT citations
• NEVER put citations in General Knowledge
• NEVER put uncited content in Knowledge Base

CRITICAL SEARCH REQUIREMENT:
⚠️ You MUST search the knowledge base before claiming any content doesn't exist.
⚠️ NEVER say "there is no content about X" without first searching for:
   - The exact term
   - Variations and synonyms
   - Related concepts

RESPONSE STRUCTURE (REQUIRED):
Always structure your response with these two sections in this exact order:

## 📚 From the Knowledge Base
[CRITICAL: This section MUST contain ONLY the results from your MCP tool searches. Include ALL relevant information found from your searches with proper citations and source links. If searches return results, provide COMPREHENSIVE summaries with their sources. This section should be RICH and DETAILED - more so than general knowledge because it contains specialized, curated content.

⚠️ NEVER PUT GENERAL AI KNOWLEDGE HERE - ONLY MCP SEARCH RESULTS
✅ This section should be the PRIMARY source of information, with more detail than General Knowledge]

## 🧠 From General Knowledge
[CRITICAL: This section MUST contain ONLY your built-in training knowledge - NOT MCP search results. Add brief, complementary context that supplements the rich Knowledge Base content above. This section should be SHORTER than Knowledge Base since the MCP has specialized content.

⚠️ NEVER PUT MCP SEARCH RESULTS, CITATIONS, OR SOURCE LINKS HERE - ONLY YOUR TRAINING DATA
✅ Keep this section concise - the Knowledge Base above has the detailed, authoritative content]

SEARCH STRATEGY:
1. ALWAYS search using search_chunks for detailed information
2. ALSO use search_documentation for broader context
3. If the first search seems incomplete, try variations of the query
4. The knowledge base may include glossaries and definitions - check these

LINK FORMATTING RULES:
• ALWAYS use proper Markdown link format: [link text](URL)
• NEVER show raw URLs alongside linked text
• Example: ✅ [Documentation Title](https://example.com/docs)
• Wrong: ❌ https://example.com/docs [Documentation Title]
• Wrong: ❌ Documentation Title (https://example.com/docs)

SECTION ASSIGNMENT RULES (ABSOLUTELY CRITICAL - NEVER VIOLATE):
• MCP tool results → "📚 From the Knowledge Base" section ONLY
• Your training knowledge → "🧠 From General Knowledge" section ONLY
• Citations and source links → Knowledge Base section ONLY
• Generic best practices without citations → General Knowledge section ONLY
• NEVER mix MCP results with training knowledge in the same section
• If you cite a source, it MUST be in the Knowledge Base section
• If it comes from a search result, it MUST be in the Knowledge Base section

FORMATTING GUIDELINES:
• Use natural paragraphs for explanations
• Bullet points are fine for lists of items or features (but don't overuse)
• For step-by-step instructions, numbered lists work well
• Cite sources inline naturally: [Source Name](url)

IMPORTANT: Always search thoroughly using multiple query variations before claiming information doesn't exist in the knowledge base.`;
		*/ // END OF BAD PROMPT - Using the good prompt from line 120 instead

		// Initialize MCP server if not already done
		if (!server) {
			server = new McpServer({
				name: `${env.ORGANIZATION_NAME || 'Organization'} Documentation`,
				version: "1.0.0",
			});

			// Initialize MCP tools
			initializeMcpTools(server);
		}

		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			return handleMcpRequest(request, env);
		}

	if (url.pathname === "/ai-chat") {
		return handleAiChat(request, env);
	}

	if (url.pathname === "/slack" && request.method === "POST") {
		// Ensure content is loaded for Slack commands
		await ensureContentLoaded();
		return handleSlackCommand(request, env, ctx);
	}

	// Simple JSON search endpoint for Slack Socket Mode bot and other clients
	if (url.pathname === "/search" && request.method === "POST") {
		await ensureContentLoaded();
		try {
			const { query, limit = 5 } = await request.json() as any;
			if (!query || typeof query !== 'string') {
				return new Response(JSON.stringify({ error: 'Invalid query' }), { status: 400, headers: { "Content-Type": "application/json" }});
			}

			// Debug: Log environment availability
			console.log('[Search] Env check:', {
				hasSupabaseUrl: !!env?.SUPABASE_URL,
				hasSupabaseKey: !!env?.SUPABASE_ANON_KEY,
				vectorEnabled: env?.VECTOR_SEARCH_ENABLED,
				vectorMode: env?.VECTOR_SEARCH_MODE
			});

			// Try Supabase first if available, otherwise use local chunks
			let mapped;
			if (env?.SUPABASE_URL && env?.SUPABASE_ANON_KEY) {
				console.log('[Search] Using Supabase search');
				// Use searchEntries which checks Supabase
				const entries = await searchEntries({ query, limit }, env);
				mapped = entries.map(e => {
					// Try to extract source URL from content frontmatter if metadata doesn't have it
					let sourceUrl = e.metadata?.source || e.metadata?.source_url || '';
					if (!sourceUrl && e.content) {
						// Extract from frontmatter in content
						const sourceMatch = e.content.match(/^source:\s*(https?:\/\/[^\n]+)/m);
						if (sourceMatch) {
							sourceUrl = sourceMatch[1];
						}
					}
					return {
						title: e.title,
						content: e.content.slice(0, 500),
						source: sourceUrl || e.source?.location || '',
						relevance: 1,
						metadata: {
							category: e.metadata?.category,
							tags: e.metadata?.tags,
							system: e.metadata?.system,
							source: sourceUrl
						}
					};
				});
			} else {
				console.log('[Search] Falling back to local chunks');
				// Fallback to local chunks
				const results = searchChunks(query, limit, { enableDiversity: true, maxPerSource: 2, preferUrls: true });
				mapped = results.map(r => {
				const { url } = formatSourceReference(r.entry);
				// Clean and truncate text for API consumers
				const cleanText = (r.chunk.text || '')
					.replace(/^[\-\*•]\s*/gm, '')
					.replace(/\n{3,}/g, '\n\n')
					.replace(/^#+\s*/gm, '')
					.trim();
				return {
					title: r.entry.title,
					content: cleanText,
					source: url || r.entry.source?.location || '',
					relevance: r.score ?? 0,
					// Include metadata with source URL from frontmatter
					metadata: {
						category: r.entry.metadata?.category,
						tags: r.entry.metadata?.tags,
						system: r.entry.metadata?.system,
						source: r.entry.metadata?.source || r.entry.metadata?.source_url
					}
				};
				});
			}
			return new Response(JSON.stringify({ results: mapped, total: mapped.length, query }), { headers: { "Content-Type": "application/json" }});
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e?.message || 'Search failed' }), { status: 500, headers: { "Content-Type": "application/json" }});
		}
	}

		// Serve the AI chat interface
		if (url.pathname === "/" || url.pathname === "/chat") {
			return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${env.ORGANIZATION_NAME || 'Organization'} Documentation Assistant</title>
    <meta name="description" content="MCP (Model Context Protocol) server with ${env.ORGANIZATION_NAME || 'organization'} documentation. Search through curated resources to get expert answers.">

    <!-- Favicon -->
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1080 482'%3E%3Cstyle%3E.st1%7Bfill:%23333333%7D@media (prefers-color-scheme:dark)%7B.st1%7Bfill:%23ffffff%7D%7D%3C/style%3E%3Cpath class='st1' d='M439.7 462.3c-12 0-22.1 4.8-30.1 16.8l-32.7-192.9 2.6-1.4C422.9 351 490.5 392 549.4 392c42.9 0 71-17.4 71-46.9 0-30.1-39.5-44.9-102.3-66.3-59.6-21.4-133.2-54.3-133.2-140.8 0-77.7 71-138 170-138 54.9 0 81 15.4 99.7 15.4 10.8 0 18.1-3.4 25.4-12.8l21.4 170.7-2.6 1.4c-32.1-54.3-86.4-85.7-142.5-85.7-44.1 0-73.6 20.2-73.6 46.9 0 30.2 38.9 42.9 79.6 58.9 70.2 24.2 158 57.5 157.2 148.8 0 80.3-70.2 138.6-164 138.6C497.9 482.2 460.4 462.3 439.7 462.3z'/%3E%3Cpath class='st1' d='M831.5 2.5l126.3 236.7L830.4 477.9h124.2L1080 239.2 956.8 2.5H831.5z'/%3E%3Cpath class='st1' d='M125.4 2.5L0 241.2l123.2 236.7h125.2L122.2 241.2 249.6 2.5H125.4z'/%3E%3C/svg%3E">

    <!-- Open Graph / Social Media Meta Tags -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${env.ORGANIZATION_NAME || 'Organization'} Documentation Assistant">
    <meta property="og:description" content="MCP server with ${env.ORGANIZATION_NAME || 'organization'} documentation and curated resources.">
    <meta property="og:url" content="${env.ORGANIZATION_DOMAIN || 'example.com'}">
    <meta property="og:image" content="${env.ORGANIZATION_DOMAIN || 'example.com'}/og-image.png">
    <meta property="og:image:width" content="900">
    <meta property="og:image:height" content="630">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${env.ORGANIZATION_NAME || 'Organization'} Documentation">
    <meta name="twitter:description" content="MCP server with ${env.ORGANIZATION_NAME || 'organization'} documentation and curated resources">
    <meta name="twitter:image" content="${env.ORGANIZATION_DOMAIN || 'example.com'}/og-image.png">

    <!-- Additional Meta -->
    <meta name="theme-color" content="#339af0">
    <meta name="author" content="Southleft">
    <link rel="canonical" href="${env.ORGANIZATION_DOMAIN || 'example.com'}">

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        }
        #root {
            min-height: 100vh;
        }
        .loader-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #1a1b1e;
            color: #c1c2c5;
            z-index: 9999;
        }
        .loader {
            display: inline-block;
            width: 24px;
            height: 24px;
            border: 3px solid #495057;
            border-radius: 50%;
            border-top-color: #339af0;
            animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="loader" class="loader-container">
        <div style="text-align: center;">
            <div class="loader"></div>
            <div style="margin-top: 16px; font-size: 14px;">Loading Documentation Chat...</div>
        </div>
    </div>
    <div id="root"></div>

    <!-- React and ReactDOM -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

    <!-- Babel Standalone for JSX -->
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <!-- Marked for markdown parsing - preload for better performance -->
    <link rel="preload" href="https://cdn.jsdelivr.net/npm/marked/marked.min.js" as="script">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

    <script type="text/babel">
        // Configure marked for better rendering
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });

        const { useState, useEffect, useRef } = React;
        const { createRoot } = ReactDOM;

        // Set dark theme on document immediately (not in useEffect)
        document.documentElement.setAttribute('data-color-scheme', 'dark');

        const Container = ({ children, size = 'lg', style = {} }) => (
            <div style={{
                maxWidth: size === 'lg' ? '900px' : '100%',
                margin: '0 auto',
                padding: '0 16px',
                width: '100%',
                ...style
            }}>
                {children}
            </div>
        );

        const Stack = ({ children, gap = 'md', style = {} }) => (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: gap === 'md' ? '16px' : gap === 'lg' ? '24px' : gap === 'sm' ? '8px' : gap,
                ...style
            }}>
                {children}
            </div>
        );

        const Group = ({ children, justify = 'flex-start', align = 'center', gap = 'md', style = {} }) => (
            <div style={{
                display: 'flex',
                justifyContent: justify,
                alignItems: align,
                gap: gap === 'md' ? '16px' : gap === 'lg' ? '24px' : gap === 'sm' ? '8px' : gap,
                flexWrap: 'wrap',
                ...style
            }}>
                {children}
            </div>
        );

        const Card = ({ children, padding = 'md', radius = 'md', withBorder = true, style = {} }) => (
            <div style={{
                background: '#25262b',
                border: withBorder ? '1px solid #373a40' : 'none',
                borderRadius: radius === 'md' ? '8px' : radius === 'lg' ? '12px' : radius,
                padding: padding === 'md' ? '16px' : padding === 'lg' ? '24px' : padding,
                ...style
            }}>
                {children}
            </div>
        );

        const Title = ({ children, order = 1, style = {} }) => {
            const Tag = \`h\${order}\`;
            const fontSize = order === 1 ? '32px' : order === 2 ? '24px' : order === 3 ? '20px' : '16px';
            return (
                <Tag style={{
                    color: '#c1c2c5',
                    margin: 0,
                    fontSize,
                    fontWeight: order <= 2 ? '700' : '600',
                    ...style
                }}>
                    {children}
                </Tag>
            );
        };

        const Text = ({ children, size = 'sm', c = '#909296', fw, style = {} }) => (
            <p style={{
                color: c,
                margin: 0,
                fontSize: size === 'sm' ? '14px' : size === 'md' ? '16px' : size === 'lg' ? '18px' : size,
                fontWeight: fw || 'normal',
                ...style
            }}>
                {children}
            </p>
        );

        const Button = ({ children, variant = 'filled', size = 'md', leftSection, rightSection, loading, disabled, onClick, style = {} }) => {
            const baseStyle = {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: size === 'md' ? '10px 16px' : '8px 12px',
                border: 'none',
                borderRadius: '6px',
                cursor: disabled || loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                opacity: disabled || loading ? 0.6 : 1,
                ...style
            };

            const variantStyles = {
                filled: {
                    background: 'linear-gradient(135deg, #339af0 0%, #1c7ed6 100%)',
                    color: 'white',
                },
                light: {
                    background: '#1e3a5f',
                    color: '#339af0',
                },
                outline: {
                    background: 'transparent',
                    color: '#339af0',
                    border: '1px solid #339af0',
                }
            };

            return (
                <button
                    style={{ ...baseStyle, ...variantStyles[variant] }}
                    onClick={disabled || loading ? undefined : onClick}
                    disabled={disabled || loading}
                >
                    {loading && <div className="loader" style={{width: '16px', height: '16px'}}></div>}
                    {leftSection}
                    {children}
                    {rightSection}
                </button>
            );
        };

        const Textarea = ({ placeholder, value, onChange, onKeyDown, rows = 3, style = {} }) => (
            <textarea
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                rows={rows}
                style={{
                    width: '100%',
                    background: '#1a1b1e',
                    border: '1px solid #373a40',
                    borderRadius: '6px',
                    padding: '12px',
                    color: '#c1c2c5',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '26px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    ...style
                }}
                onFocus={(e) => e.target.style.borderColor = '#339af0'}
                onBlur={(e) => e.target.style.borderColor = '#373a40'}
            />
        );

        const Badge = ({ children, variant = 'light', color = 'blue', size = 'sm', style = {}, title = '' }) => {
            const getColors = () => {
                if (color === 'green') return { bg: '#2f5233', text: '#51cf66' };
                if (color === 'red') return { bg: '#5f2f2f', text: '#ff6b6b' };
                if (color === 'yellow') return { bg: '#5f4f2f', text: '#ffd43b' };
                return { bg: '#1e3a5f', text: '#339af0' };
            };

            const colors = getColors();

            return (
                <span style={{
                    display: 'inline-block',
                    padding: size === 'sm' ? '4px 8px' : '6px 12px',
                    backgroundColor: colors.bg,
                    color: colors.text,
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    ...style
                }} title={title}>
                    {children}
                </span>
            );
        };

        const ScrollArea = ({ children, style = {} }) => (
            <div style={{
                overflow: 'auto',
                ...style
            }}>
                {children}
            </div>
        );

        // Example questions data
        const EXAMPLE_QUESTIONS = [
            { icon: '❓', text: 'Overview' },
            { icon: '🚀', text: 'Getting Started' },
            { icon: '🎨', text: 'Theming' },
            { icon: '🧩', text: 'Tokens' },
            { icon: '🤝', text: 'Support' }
        ];

        // Chat App Component
        function ChatApp() {
            const [messages, setMessages] = useState([{
                type: 'system',
                content: \`🎯 Welcome! I'm your AI documentation assistant for ${env.ORGANIZATION_NAME || 'the organization'}. I can search through the knowledge base and provide expert answers.\n\n💡 Ask me anything about our documentation and processes!\`
            }]);
            const [inputValue, setInputValue] = useState('');
            const [isLoading, setIsLoading] = useState(false);
            const [serviceStatus, setServiceStatus] = useState('checking'); // 'online', 'offline', 'checking'
            const messagesEndRef = useRef(null);
            const textareaRef = useRef(null);
            const textareaRef2 = useRef(null);

            // Set dark theme on document
            useEffect(() => {
                document.documentElement.setAttribute('data-color-scheme', 'dark');
            }, []);

            const scrollToBottom = () => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            };

            useEffect(() => {
                scrollToBottom();
            }, [messages]);

            // Check service health on mount and periodically
            useEffect(() => {
                const checkHealth = async () => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);

                        const response = await fetch('/health', {
                            method: 'GET',
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);

                        if (response.ok) {
                            const data = await response.json();
                            setServiceStatus(data.status === 'ok' ? 'online' : 'offline');
                        } else {
                            setServiceStatus('offline');
                        }
                    } catch (error) {
                        setServiceStatus('offline');
                    }
                };

                // Check immediately
                checkHealth();

                // Check every 30 seconds
                const interval = setInterval(checkHealth, 30000);

                return () => clearInterval(interval);
            }, []);

            // Auto-resize textareas
            const autoResizeTextarea = (textarea) => {
                if (textarea) {
                    textarea.style.height = 'auto';
                    const newHeight = Math.min(textarea.scrollHeight, 200);
                    textarea.style.height = newHeight - 22 + 'px';
                }
            };

            useEffect(() => {
                autoResizeTextarea(textareaRef.current);
                autoResizeTextarea(textareaRef2.current);
            }, [inputValue]);

            // Add input handler for real-time resizing
            const handleTextareaInput = (e) => {
                setInputValue(e.target.value);
                autoResizeTextarea(e.target);
            };

            const addMessage = (type, content) => {
                setMessages(prev => [...prev, { type, content, id: Date.now() }]);
            };

            const askQuestion = (question) => {
                setInputValue(question);
                setTimeout(() => sendMessage(question), 100);
            };

            const sendMessage = async (messageText = inputValue) => {
                const message = messageText.trim();
                if (!message) return;

                addMessage('user', message);
                setInputValue('');
                setIsLoading(true);

                // Add thinking message
                const thinkingId = Date.now();
                addMessage('thinking', 'Analyzing your question and searching the knowledge base...');

                try {
                    // Add client-side timeout (45 seconds total, matching server timeout)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => {
                        controller.abort();
                    }, 45000); // 45 second timeout (matching server timeout)

                    const response = await fetch('/ai-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        // Remove thinking message before throwing
                        setMessages(prev => prev.filter(msg => msg.type !== 'thinking'));
                        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                    }

                    const data = await response.json();
                    console.log('[Chat] API Response received:', {
                        hasError: !!data.error,
                        hasResponse: !!data.response,
                        responseLength: data.response?.length || 0,
                        searchResults: data.searchResults || 0,
                        timestamp: new Date().toISOString()
                    });

                    // Remove thinking message and add response in a single state update
                    if (data.error) {
                        console.error('API returned error:', data.error);
                        setMessages(prev => {
                            const filtered = prev.filter(msg => msg.type !== 'thinking');
                            return [...filtered, { type: 'error', content: \`❌ \${data.error}\`, id: Date.now() }];
                        });
                    } else if (data.response) {
                        console.log('[Chat] Adding assistant response to UI, length:', data.response.length);
                        setMessages(prev => {
                            const filtered = prev.filter(msg => msg.type !== 'thinking');
                            return [...filtered, { type: 'assistant', content: data.response, id: Date.now() }];
                        });
                        setIsLoading(false); // Ensure loading state is cleared
                    } else {
                        console.error('Unexpected response structure:', data);
                        setMessages(prev => {
                            const filtered = prev.filter(msg => msg.type !== 'thinking');
                            return [...filtered, { type: 'error', content: '❌ Invalid response from server - check console for details', id: Date.now() }];
                        });
                    }
                } catch (error) {
                    setMessages(prev => prev.filter(msg => msg.type !== 'thinking'));

                    let errorMessage = error.message;
                    if (error.name === 'AbortError' || error.message.includes('aborted')) {
                        errorMessage = '⏱️ Request timed out after 45 seconds. This can happen with complex questions. Try breaking your question into smaller parts or asking something more specific.';
                    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        errorMessage = '🌐 Network error. Please check your internet connection and try again.';
                    } else if (error.message.includes('timeout')) {
                        errorMessage = '⏱️ The request took too long to process. Try asking a more specific question or try again later.';
                    }

                    addMessage('error', \`❌ Error: \${errorMessage}\`);
                } finally {
                    setIsLoading(false);
                }
            };

            const handleKeyPress = (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                }
            };

            const MessageComponent = ({ message }) => {
                const getMessageStyle = (type) => {
                    const base = {
                        padding: '16px 24px',
                        marginBottom: '16px',
                        lineHeight: '1.6',
                        fontSize: '16px'
                    };

                    switch (type) {
                        case 'user':
                            return {
                                ...base,
                                background: '#2c2e33',
                                color: '#c1c2c5',
                                borderRadius: '12px',
                                maxWidth: '85%',
                                marginLeft: 'auto',
                                marginRight: '0'
                            };
                        case 'assistant':
                            return {
                                ...base,
                                background: '#25262b',
                                color: '#c1c2c5',
                                borderRadius: '12px',
                                maxWidth: '85%',
                                marginLeft: '0',
                                marginRight: 'auto'
                            };
                        case 'thinking':
                            return {
                                ...base,
                                background: '#25262b',
                                color: '#909296',
                                border: '1px solid #373a40',
                                fontStyle: 'normal',
                                borderRadius: '12px',
                                maxWidth: '100%',
                                marginLeft: '0',
                                marginRight: '0'
                            };
                        case 'error':
                            return {
                                ...base,
                                background: '#2d0e0e',
                                color: '#ff6b6b',
                                border: '1px solid #e03131',
                                borderRadius: '8px',
                                maxWidth: '85%',
                                marginLeft: '0',
                                marginRight: 'auto'
                            };
                        default:
                            return base;
                    }
                };

                const renderContent = (content, type) => {
                    if (type === 'assistant') {
                        return { __html: marked.parse(content) };
                    }
                    if (type === 'thinking') {
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', gap: '3px' }}>
                                    <span style={{
                                        width: '6px', height: '6px', background: '#339af0', borderRadius: '50%',
                                        animation: 'thinking 1.5s ease-in-out infinite'
                                    }}></span>
                                    <span style={{
                                        width: '6px', height: '6px', background: '#339af0', borderRadius: '50%',
                                        animation: 'thinking 1.5s ease-in-out infinite 0.2s'
                                    }}></span>
                                    <span style={{
                                        width: '6px', height: '6px', background: '#339af0', borderRadius: '50%',
                                        animation: 'thinking 1.5s ease-in-out infinite 0.4s'
                                    }}></span>
                                </div>
                                {content}
                            </div>
                        );
                    }
                    return content;
                };

                // Don't render system messages in conversation view
                if (message.type === 'system') {
                    return null;
                }

                return (
                    <div style={{
                        maxWidth: '768px',
                        margin: '0 auto',
                        width: '100%',
                        padding: '0 24px'
                    }}>
                        <div style={getMessageStyle(message.type)}>
                            {message.type === 'assistant' ? (
                                <div className="message-content" dangerouslySetInnerHTML={renderContent(message.content, message.type)} />
                            ) : (
                                renderContent(message.content, message.type)
                            )}
                        </div>
                    </div>
                );
            };

            return (
                <div style={{
                    minHeight: '100vh',
                    background: '#1a1b1e',
                    color: '#c1c2c5',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Container size="lg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0' }}>
                        {/* Floating Header */}
                        <div style={{
                            background: '#25262b',
                            border: '1px solid #373a40',
                            borderRadius: '0 0 16px 16px',
                            padding: '16px 24px',
                            position: 'sticky',
                            top: 0,
                            zIndex: 100,
                            margin: '0 16px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}>
                            <Group justify="space-between" align="center">
                                <div>
                                    <Title order={3} style={{ color: '#c1c2c5', marginBottom: '2px', fontWeight: '600' }}>
                                        ` + (env.ORGANIZATION_NAME || 'Organization') + ` Documentation
                                    </Title>
                                    <Text size="sm" style={{ color: '#909296' }}>
                                        ` + (env.ORGANIZATION_SUBTITLE || 'Powered by MCP (Model Context Protocol)') + `
                                    </Text>
                                </div>
                                <Badge
                                    variant="light"
                                    color={serviceStatus === 'online' ? 'green' : serviceStatus === 'checking' ? 'yellow' : 'red'}
                                    size="sm"
                                    style={{
                                        cursor: 'default',
                                        transition: 'all 0.3s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    title={serviceStatus === 'online' ? 'Service is operational' : serviceStatus === 'checking' ? 'Checking connection...' : 'Service unavailable - check your connection'}
                                >
                                    <span style={{
                                        display: 'inline-block',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: serviceStatus === 'online' ? '#51cf66' : serviceStatus === 'checking' ? '#ffd43b' : '#ff6b6b',
                                        animation: serviceStatus === 'checking' ? 'pulse 2s infinite' : 'none'
                                    }}></span>
                                    {serviceStatus === 'online' ? 'Online' : serviceStatus === 'checking' ? 'Checking...' : 'Offline'}
                                </Badge>
                            </Group>
                        </div>

                        {/* Messages Area */}
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '0 24px'
                        }}>
                            <ScrollArea style={{ flex: 1 }}>
                                {messages.filter(msg => msg.type !== 'system').length === 0 ? (
                                    // Welcome screen when no messages - centered like ChatGPT
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 'calc(100vh - 220px)',
                                        textAlign: 'center',
                                    }}>
                                        {/* Organization Logo with MCP fallback */}
                                        <div style={{ marginBottom: '32px' }}>
                                            <img
                                                src="` + (env.ORGANIZATION_LOGO_URL || 'https://p198.p4.n0.cdn.zight.com/items/4guEeYlX/50dfc8bb-d31c-4a22-81ab-cee7ed5a5c18.png') + `"
                                                alt="` + (env.ORGANIZATION_NAME || 'MCP') + ` Logo"
                                                style={{
                                                    maxHeight: '120px',
                                                    maxWidth: '300px',
                                                    height: 'auto',
                                                    width: 'auto',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        </div>

                                        {/* Elegant centered title */}
                                        <div style={{ marginBottom: '48px' }}>
                                            <Title
                                                order={1}
                                                style={{
                                                    color: '#c1c2c5',
                                                    marginBottom: '16px',
                                                    fontSize: '48px',
                                                    fontWeight: '300',
                                                    letterSpacing: '-0.02em'
                                                }}
                                            >
                                                ` + (env.ORGANIZATION_NAME || 'Organization') + ` Documentation
                                            </Title>
                                            <Text
                                                style={{
                                                    color: '#909296',
                                                    fontSize: '18px',
                                                    fontWeight: '400',
                                                    maxWidth: '600px',
                                                    lineHeight: '1.5',
                                                    margin: '0 auto'
                                                }}
                                            >
                                                ` + (env.ORGANIZATION_TAGLINE || "Get instant answers from our comprehensive documentation. Ask about APIs, components, patterns, and best practices.") + `
                                            </Text>
                                        </div>

                                        {/* Centered input area */}
                                        <div style={{
                                            width: '100%',
                                            maxWidth: '768px',
                                            marginBottom: '32px'
                                        }}>
                                            <div style={{
                                                background: '#25262b',
                                                border: '1px solid #373a40',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0',
                                                transition: 'border-color 0.2s ease'
                                            }}
                                            onFocus={(e) => e.currentTarget.style.borderColor = '#339af0'}
                                            onBlur={(e) => e.currentTarget.style.borderColor = '#373a40'}
                                            >
                                                <textarea
                                                    ref={textareaRef}
                                                    placeholder="Ask me anything about our documentation..."
                                                    value={inputValue}
                                                    onChange={(e) => handleTextareaInput(e)}
                                                    onKeyDown={handleKeyPress}
                                                    rows={1}
                                                    style={{
                                                        flex: 1,
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#c1c2c5',
                                                        fontSize: '16px',
                                                        fontFamily: 'inherit',
                                                        resize: 'none',
                                                        outline: 'none',
                                                        padding: '12px 16px',
                                                        lineHeight: '1.5',
                                                        maxHeight: '200px',
                                                        overflowY: 'auto'
                                                    }}
                                                    disabled={isLoading}
                                                    onFocus={(e) => {
                                                        e.target.parentElement.style.borderColor = '#339af0';
                                                    }}
                                                    onBlur={(e) => {
                                                        e.target.parentElement.style.borderColor = '#373a40';
                                                    }}
                                                />
                                                <button
                                                    onClick={() => sendMessage()}
                                                    disabled={!inputValue.trim() || isLoading}
                                                    style={{
                                                        background: inputValue.trim() && !isLoading
                                                            ? '#339af0'
                                                            : '#373a40',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        padding: '8px',
                                                        margin: '8px',
                                                        cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s ease',
                                                        minWidth: '32px',
                                                        height: '32px'
                                                    }}
                                                >
                                                    {isLoading ? (
                                                        <div style={{
                                                            width: '16px',
                                                            height: '16px',
                                                            border: '2px solid #ffffff40',
                                                            borderTop: '2px solid #ffffff',
                                                            borderRadius: '50%',
                                                            animation: 'spin 1s linear infinite'
                                                        }} />
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{
                                                            color: inputValue.trim() ? 'white' : '#909296'
                                                        }}>
                                                            <path
                                                                d="M7 11L12 6L17 11M12 18V7"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                transform="rotate(90 12 12)"
                                                            />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Topic suggestions below input */}
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                            justifyContent: 'center',
                                            maxWidth: '768px',
                                            marginBottom: '32px'
                                        }}>
                                                                                    {EXAMPLE_QUESTIONS.map((item, index) => (
                                                <button
                                                    key={index}
                                                    style={{
                                                        padding: '8px 16px',
                                                        background: 'transparent',
                                                        border: '1px solid #373a40',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                        color: '#909296',
                                                        transition: 'all 0.2s ease',
                                                        fontFamily: 'inherit',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.target.style.borderColor = '#339af0';
                                                        e.target.style.color = '#339af0';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.target.style.borderColor = '#373a40';
                                                        e.target.style.color = '#909296';
                                                    }}
                                                    onClick={() => {
                                                        const queries = {
                                                            'Overview': 'What documentation is available?',
                                                            'Getting Started': 'How do I get started?',
                                                            'Theming': 'Tell me about theming',
                                                            'Tokens': 'Where can I find more information on tokens?',
                                                            'Support': 'How do I get support?'
                                                        };
                                                        askQuestion(queries[item.text] || item.text);
                                                    }}
                                                >
                                                    <span>{item.icon}</span>
                                                    <span>{item.text}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Subtle helper text */}
                                        <Text
                                            size="sm"
                                            style={{
                                                color: '#6c6f75',
                                                fontSize: '14px'
                                            }}
                                        >
                                            Press Enter to send, Shift+Enter for new line
                                        </Text>
                                    </div>
                                ) : (
                                    // Regular chat messages
                                    <div style={{ padding: '24px 0' }}>
                                        {messages.filter(msg => msg.type !== 'system').map((message) => (
                                            <MessageComponent key={message.id || Math.random()} message={message} />
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        {/* Input Area for active conversations */}
                        {messages.filter(msg => msg.type !== 'system').length > 0 ? (
                            <div style={{
                                padding: '16px 24px 24px',
                                borderTop: '1px solid #373a40',
                                background: '#1a1b1e'
                            }}>
                                <div style={{
                                    maxWidth: '768px',
                                    margin: '0 auto',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        background: '#25262b',
                                        border: '1px solid #373a40',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'border-color 0.2s ease'
                                    }}>
                                        <textarea
                                            ref={textareaRef2}
                                            placeholder="Ask me anything about our documentation..."
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyPress}
                                            rows={1}
                                            style={{
                                                flex: 1,
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#c1c2c5',
                                                fontSize: '16px',
                                                fontFamily: 'inherit',
                                                resize: 'none',
                                                outline: 'none',
                                                padding: '12px 16px',
                                                lineHeight: '1.5',
                                                maxHeight: '200px',
                                                overflowY: 'auto'
                                            }}
                                            disabled={isLoading}
                                            onFocus={(e) => {
                                                e.target.parentElement.style.borderColor = '#339af0';
                                            }}
                                            onBlur={(e) => {
                                                e.target.parentElement.style.borderColor = '#373a40';
                                            }}
                                        />
                                        <button
                                            onClick={() => sendMessage()}
                                            disabled={!inputValue.trim() || isLoading}
                                            style={{
                                                background: inputValue.trim() && !isLoading
                                                    ? '#339af0'
                                                    : '#373a40',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '8px',
                                                margin: '8px',
                                                cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease',
                                                minWidth: '32px',
                                                height: '32px'
                                            }}
                                        >
                                            {isLoading ? (
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    border: '2px solid #ffffff40',
                                                    borderTop: '2px solid #ffffff',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                }} />
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{
                                                    color: inputValue.trim() ? 'white' : '#909296'
                                                }}>
                                                    <path
                                                        d="M7 11L12 6L17 11M12 18V7"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        transform="rotate(90 12 12)"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </Container>

                    {/* Footer */}
                    <footer style={{
                        background: '#25262b',
                        borderTop: '1px solid #373a40',
                        padding: '16px 24px',
                        textAlign: 'center',
                        marginTop: 'auto'
                    }}>
                        <Text size="sm" style={{ color: '#6c6f75', fontSize: '13px', marginBottom: '8px' }}>
                            🤖 ` + (env.ORGANIZATION_NAME || 'Organization') + ` Documentation Assistant • Powered by MCP
                        </Text>
                        <Text size="sm" style={{ color: '#6c6f75', fontSize: '13px' }}>
                            Made with ❤️ by{' '}
                            <a
                                href="https://southleft.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: '#339af0',
                                    textDecoration: 'none',
                                    fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                            >
                                Southleft
                            </a>
                        </Text>
                    </footer>
                </div>
            );
        }

        // Hide loader and render app
        function init() {
            document.getElementById('loader').style.display = 'none';
            const root = createRoot(document.getElementById('root'));
            root.render(<ChatApp />);
        }

        // Initialize when everything is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    </script>

    <style>
        @keyframes thinking {
            0%, 60%, 100% {
                transform: scale(1);
                opacity: 0.3;
            }
            30% {
                transform: scale(1.2);
                opacity: 1;
            }
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }

        /* Custom scrollbar for dark theme */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #25262b;
        }
        ::-webkit-scrollbar-thumb {
            background: #495057;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #5c6370;
        }

        /* Enhanced markdown styling */
        .message-content {
            line-height: 1.6;
            color: #c1c2c5;
        }

        .message-content h1,
        .message-content h2,
        .message-content h3,
        .message-content h4,
        .message-content h5,
        .message-content h6 {
            margin: 24px 0 16px 0;
            font-weight: 600;
        }

        .message-content h1 { font-size: 24px; }
        .message-content h2 { font-size: 20px; }
        .message-content h3 { font-size: 18px; }
        .message-content h4 { font-size: 16px; }

        .message-content h2:not(:first-child) {
            padding-top: 30px;
            margin-top: 30px;
            border-top: 1px solid #ffffff40;
        }

        .message-content p {
            margin: 12px 0;
            line-height: 1.6;
        }

        .message-content ul,
        .message-content ol {
            margin: 14px 0;
            padding-left: 24px;
        }

        .message-content li {
            margin: 6px 0;
            line-height: 1.4;
        }

        .message-content ul li {
            list-style-type: disc;
        }

        .message-content ul li li {
            list-style-type: circle;
        }

        .message-content ol li {
            list-style-type: decimal;
        }

        .message-content ol li li {
            list-style-type: lower-alpha;
        }

        .message-content a {
            color: #339af0;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s ease;
        }

        .message-content a:hover {
            border-bottom-color: #339af0;
        }

        .message-content code {
            background: #2c2e33;
            color: #ff7979;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 14px;
        }

        .message-content pre {
            background: #2c2e33;
            color: #c1c2c5;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 16px 0;
        }

        .message-content pre code {
            background: none;
            padding: 0;
            color: inherit;
        }

        .message-content blockquote {
            border-left: 3px solid #339af0;
            background: #2c2e33;
            margin: 16px 0;
            padding: 12px 16px;
            color: #909296;
            font-style: italic;
        }

        .message-content hr {
            border: none;
            border-top: 1px solid #373a40;
            margin: 20px 0;
        }

        .message-content strong {
            color: #fff;
            font-weight: 600;
        }

        .message-content em {
            color: #b3b6ba;
            font-style: italic;
        }
    </style>
</body>
</html>
			`, {
				headers: {
					"Content-Type": "text/html",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}

		// Health check endpoint
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({
				status: "ok",
				service: `${env.ORGANIZATION_NAME || 'Documentation'} MCP`,
				version: "1.0.0"
			}), {
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}

		return new Response(`${env.ORGANIZATION_NAME || 'Documentation'} MCP Server - Use /mcp or /ai-chat endpoints`, {
			status: 200,
			headers: {
				"Content-Type": "text/plain",
				"Access-Control-Allow-Origin": "*"
			}
		});
	},
};
