/**
 * AI model provider configuration.
 *
 * Controlled by two env vars:
 *   - AI_PROVIDER: which service to use (groq | openai | anthropic | google). Default: groq
 *   - AI_MODEL:    optional model override (each provider has a sensible default)
 *
 * The rest of the codebase only imports `getModel()` from this file.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type AIProvider = "groq" | "openai" | "anthropic" | "google";

export const PROVIDER_CONFIG: Record<AIProvider, { defaultModel: string; apiKeyEnv: string }> = {
  groq: {
    defaultModel: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY",
  },
  openai: { defaultModel: "gpt-4o-mini", apiKeyEnv: "OPENAI_API_KEY" },
  anthropic: {
    defaultModel: "claude-haiku-4-5",
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  google: {
    defaultModel: "gemini-2.0-flash",
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
  },
};

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_CONFIG) as AIProvider[];

export function getModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER ?? "groq") as AIProvider;
  const config = PROVIDER_CONFIG[provider];
  if (!config) {
    throw new Error(
      `Unsupported AI_PROVIDER: "${provider}". Use one of: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
  }

  const model = process.env.AI_MODEL ?? config.defaultModel;
  const apiKey = process.env[config.apiKeyEnv];

  switch (provider) {
    case "groq":
      return createGroq({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
  }
}
