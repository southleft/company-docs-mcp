/**
 * ChatProvider — the LLM answer layer (tool-calling capable).
 *
 * This is the seam where model choice becomes configuration rather than a
 * hardcoded vendor: OpenAI today (ai-chat-handler.ts, slack-bot/index.ts),
 * Anthropic/Claude next (Wave 3). It is also the right home for "right-size
 * the model" — picking Haiku vs Opus, or gpt-4o-mini vs gpt-4o, is a property
 * of the selected ChatProvider, not of the calling code.
 *
 * The message/tool shapes are intentionally vendor-neutral; each adapter
 * translates to/from its SDK's format.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
	role: ChatRole;
	content: string | null;
	/** Set on `tool` messages: the id of the tool call being answered. */
	toolCallId?: string;
	/** Optional tool/function name for `tool` messages. */
	name?: string;
	/**
	 * Set on `assistant` messages that requested tool calls — required when
	 * feeding a prior ChatResult's tool calls back in for the follow-up turn.
	 */
	toolCalls?: ChatToolCall[];
}

export interface ChatToolDef {
	name: string;
	description: string;
	/** JSON Schema for the tool arguments. */
	parameters: Record<string, unknown>;
}

export interface ChatToolCall {
	id: string;
	name: string;
	/** Raw JSON argument string as emitted by the model. */
	arguments: string;
}

export interface ChatParams {
	messages: ChatMessage[];
	tools?: ChatToolDef[];
	/** Vendor-neutral tool_choice: force, allow, or forbid tool use. */
	toolChoice?: "auto" | "required" | "none";
	temperature?: number;
	maxTokens?: number;
}

export interface ChatResult {
	/** Final assistant text, or null when the turn is purely tool calls. */
	content: string | null;
	/** Tool calls the model wants executed before it can answer. */
	toolCalls?: ChatToolCall[];
	/** Underlying SDK response, for callers that need provider specifics. */
	raw?: unknown;
}

export interface ChatProvider {
	/** Stable selector id, e.g. "openai" | "anthropic". */
	readonly id: string;
	/** Active model identifier, e.g. "gpt-4o-mini" | "claude-haiku-4-5". */
	readonly model: string;

	/** One completion turn. The agentic loop is owned by the caller. */
	chat(params: ChatParams): Promise<ChatResult>;
}
