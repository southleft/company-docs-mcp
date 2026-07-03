/**
 * Anthropic ChatProvider implementation (Wave 3).
 *
 * Select with CHAT_PROVIDER=anthropic + ANTHROPIC_API_KEY (auto-selected when
 * ANTHROPIC_API_KEY is set and OPENAI_API_KEY is not). Model via
 * ANTHROPIC_MODEL (default claude-opus-4-8).
 *
 * Translation notes, all handled here so callers stay vendor-neutral:
 * - Anthropic takes the system prompt as a top-level `system` param, not a
 *   messages[] entry
 * - Tool results are content blocks inside a `user` message, and consecutive
 *   results must be merged into ONE user message (the API requires all
 *   tool_result blocks for a turn together)
 * - tool_use arguments are structured input (parsed), not a JSON string
 * - Modern Claude models reject sampling params (temperature/top_p), so the
 *   neutral `temperature` field is intentionally not forwarded
 */

import type { ChatProvider, ChatParams, ChatResult, ChatMessage } from "../chat";
import { ProviderError } from "../types";
import type { ProviderConfig } from "../types";

interface AnthropicRequestParts {
	system?: string;
	messages: any[];
}

/** Split the neutral message list into Anthropic's system param + messages. */
function toAnthropicMessages(neutral: ChatMessage[]): AnthropicRequestParts {
	const systemParts: string[] = [];
	const messages: any[] = [];

	for (const message of neutral) {
		if (message.role === "system") {
			if (message.content) systemParts.push(message.content);
			continue;
		}

		if (message.role === "tool") {
			const resultBlock = {
				type: "tool_result",
				tool_use_id: message.toolCallId,
				content: message.content ?? "",
			};
			// Merge consecutive tool results into a single user message
			const last = messages[messages.length - 1];
			if (last && last.role === "user" && Array.isArray(last.content) && last.content[0]?.type === "tool_result") {
				last.content.push(resultBlock);
			} else {
				messages.push({ role: "user", content: [resultBlock] });
			}
			continue;
		}

		if (message.role === "assistant" && message.toolCalls?.length) {
			const content: any[] = [];
			if (message.content) {
				content.push({ type: "text", text: message.content });
			}
			for (const call of message.toolCalls) {
				let input: unknown = {};
				try {
					input = JSON.parse(call.arguments);
				} catch {
					// Leave as empty object; the model emitted malformed JSON
				}
				content.push({ type: "tool_use", id: call.id, name: call.name, input });
			}
			messages.push({ role: "assistant", content });
			continue;
		}

		messages.push({ role: message.role, content: message.content ?? "" });
	}

	return {
		system: systemParts.length ? systemParts.join("\n\n") : undefined,
		messages,
	};
}

/** Map the neutral toolChoice to Anthropic's discriminated union. */
function toAnthropicToolChoice(toolChoice: ChatParams["toolChoice"]): any {
	switch (toolChoice) {
		case "required":
			return { type: "any", disable_parallel_tool_use: true };
		case "none":
			return { type: "none" };
		case "auto":
			return { type: "auto", disable_parallel_tool_use: true };
		default:
			return undefined;
	}
}

export function createAnthropicChat(config: ProviderConfig): ChatProvider {
	const apiKey = config.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new ProviderError(
			"ANTHROPIC_API_KEY is required for the anthropic chat provider",
			"anthropic",
		);
	}
	const model = config.ANTHROPIC_MODEL || "claude-opus-4-8";

	return {
		id: "anthropic",
		model,

		async chat(params: ChatParams): Promise<ChatResult> {
			const Anthropic = (await import("@anthropic-ai/sdk")).default;
			// TypeScript SDK timeout is milliseconds
			const anthropic = new Anthropic({ apiKey, timeout: 45000, maxRetries: 1 });

			const { system, messages } = toAnthropicMessages(params.messages);

			const request: any = {
				model,
				max_tokens: params.maxTokens ?? 16000,
				messages,
			};
			if (system) {
				request.system = system;
			}
			if (params.tools?.length) {
				request.tools = params.tools.map((tool) => ({
					name: tool.name,
					description: tool.description,
					input_schema: tool.parameters,
				}));
			}
			const toolChoice = toAnthropicToolChoice(params.toolChoice);
			if (toolChoice && params.tools?.length) {
				request.tool_choice = toolChoice;
			}

			const response = await anthropic.messages.create(request);

			let text = "";
			const toolCalls: ChatResult["toolCalls"] = [];
			for (const block of response.content) {
				if (block.type === "text") {
					text += block.text;
				} else if (block.type === "tool_use") {
					toolCalls!.push({
						id: block.id,
						name: block.name,
						arguments: JSON.stringify(block.input),
					});
				}
			}

			return {
				content: text || null,
				toolCalls: toolCalls!.length ? toolCalls : undefined,
				raw: response,
			};
		},
	};
}

// Exported for unit tests
export { toAnthropicMessages, toAnthropicToolChoice };
