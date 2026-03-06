/**
 * AI model provider configuration.
 *
 * To switch providers, change the import and the `getModel()` call below.
 * The rest of the codebase only imports `getModel()` from this file.
 *
 * Examples:
 *
 *   Groq (default — fast + cheap):
 *     import { createGroq } from "@ai-sdk/groq";
 *     const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
 *     return groq("llama-3.3-70b-versatile");
 *
 *   Anthropic:
 *     import { anthropic } from "@ai-sdk/anthropic";
 *     return anthropic("claude-sonnet-4-20250514");
 *
 *   OpenAI:
 *     import { openai } from "@ai-sdk/openai";
 *     return openai("gpt-4o");
 *
 *   Any OpenAI-compatible provider (Together, Fireworks, etc.):
 *     import { createOpenAI } from "@ai-sdk/openai";
 *     const provider = createOpenAI({ baseURL: "https://api.together.xyz/v1", apiKey: "..." });
 *     return provider("meta-llama/Llama-3.3-70B-Instruct-Turbo");
 */

import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export function getModel(): LanguageModel {
  return groq(process.env.AI_MODEL ?? "openai/gpt-oss-120b");
}
