/**
 * OpenAI ChatProvider implementation (Wave 2).
 *
 * Translates the vendor-neutral ChatParams/ChatResult shapes to and from the
 * OpenAI SDK. Model quirks (gpt-5's max_completion_tokens rename) live here,
 * not in calling code. A Wave 3 Anthropic adapter implements the same
 * interface against the Anthropic SDK.
 */

import type { ChatProvider, ChatParams, ChatResult, ChatMessage } from "../chat";
import { ProviderError } from "../types";
import type { ProviderConfig } from "../types";

function toOpenAIMessage(message: ChatMessage): any {
	if (message.role === "tool") {
		return {
			role: "tool",
			tool_call_id: message.toolCallId,
			content: message.content ?? "",
		};
	}
	if (message.role === "assistant" && message.toolCalls?.length) {
		return {
			role: "assistant",
			content: message.content,
			tool_calls: message.toolCalls.map((call) => ({
				id: call.id,
				type: "function",
				function: { name: call.name, arguments: call.arguments },
			})),
		};
	}
	return { role: message.role, content: message.content };
}

export function createOpenAIChat(config: ProviderConfig): ChatProvider {
	const apiKey = config.OPENAI_API_KEY;
	if (!apiKey) {
		throw new ProviderError(
			"OPENAI_API_KEY is required for the openai chat provider",
			"openai",
		);
	}
	const model = config.OPENAI_MODEL || "gpt-4o";

	return {
		id: "openai",
		model,

		async chat(params: ChatParams): Promise<ChatResult> {
			const OpenAI = (await import("openai")).default;
			const openai = new OpenAI({ apiKey, timeout: 45000, maxRetries: 1 });

			const request: any = {
				model,
				messages: params.messages.map(toOpenAIMessage),
				stream: false,
			};

			if (params.tools?.length) {
				request.tools = params.tools.map((tool) => ({
					type: "function",
					function: {
						name: tool.name,
						description: tool.description,
						parameters: tool.parameters,
					},
				}));
				// One tool at a time keeps the follow-up turn simple and cheap
				request.parallel_tool_calls = false;
			}
			if (params.toolChoice) {
				request.tool_choice = params.toolChoice;
			}
			if (params.temperature !== undefined) {
				request.temperature = params.temperature;
			}
			if (params.maxTokens !== undefined) {
				// gpt-5 family renamed the cap; older models reject the new name
				if (model.includes("gpt-5")) {
					request.max_completion_tokens = params.maxTokens;
				} else {
					request.max_tokens = params.maxTokens;
				}
			}

			const completion = await openai.chat.completions.create(request);
			const choice = completion.choices[0].message;

			return {
				content: choice.content ?? null,
				toolCalls: choice.tool_calls?.map((call: any) => ({
					id: call.id,
					name: call.function.name,
					arguments: call.function.arguments,
				})),
				raw: completion,
			};
		},
	};
}

// Exported for unit tests
export { toOpenAIMessage };
