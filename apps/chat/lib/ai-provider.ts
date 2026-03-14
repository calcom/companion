/**
 * AI model provider configuration for Vercel AI Gateway.
 *
 * AI SDK v6 accepts a plain "provider/model" string when AI_GATEWAY_API_KEY
 * is set — the gateway resolves the provider and routes the request automatically.
 *
 * Set AI_GATEWAY_API_KEY in your environment (from vercel.com/ai-gateway).
 * Optionally set AI_MODEL and AI_FALLBACK_MODELS to control routing.
 *
 * Examples:
 *   AI_MODEL=groq/gpt-oss-120b          (default — fast)
 *   AI_MODEL=anthropic/claude-sonnet-4.6
 *   AI_MODEL=openai/gpt-4o
 *   AI_MODEL=google/gemini-2.0-flash
 *
 *   AI_FALLBACK_MODELS=anthropic/claude-sonnet-4.6,google/gemini-2.0-flash
 *
 * Browse all available models at: https://vercel.com/ai-gateway/models
 */

const DEFAULT_MODEL = "groq/gpt-oss-120b";

export function getModel(): string {
  return process.env.AI_MODEL ?? DEFAULT_MODEL;
}

export function getFallbackModels(): string[] | undefined {
  const raw = process.env.AI_FALLBACK_MODELS;
  if (!raw) return undefined;
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}
