import {
  defineAIProvider,
  type ChatMessage,
  type ChatOptions,
} from '@strata/sdk';

/**
 * AI-provider template.
 *
 * Copy this folder to add a provider (OpenAI, Anthropic, Ollama, Azure, …).
 * Strata calls `chat()` for features like "explain this hotspot" and
 * "generate architecture docs", and the optional `embed()` for repo-wide
 * semantic search (RAG over the analysis DB).
 *
 * Read config from the environment (see .env.example) so no keys are committed:
 *   AI_BASE_URL, AI_API_KEY, AI_MODEL
 *
 * For a fully-local setup, point AI_BASE_URL at an Ollama server
 * (http://localhost:11434/v1) and leave AI_API_KEY blank.
 */
const BASE_URL = process.env.AI_BASE_URL ?? '';
const API_KEY = process.env.AI_API_KEY ?? '';
const DEFAULT_MODEL = process.env.AI_MODEL ?? '';

export default defineAIProvider({
  id: 'template',

  async listModels(): Promise<string[]> {
    // Replace with a call to the provider's /models endpoint.
    return DEFAULT_MODEL ? [DEFAULT_MODEL] : [];
  },

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    if (!BASE_URL) {
      throw new Error(
        'ai-provider-template is not configured. Copy it, set AI_BASE_URL/' +
          'AI_API_KEY/AI_MODEL, and implement chat() against your provider.',
      );
    }
    // Example OpenAI-compatible shape — adjust per provider.
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_MODEL,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens,
        messages,
      }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}`);
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return json.choices[0]?.message.content ?? '';
  },
});
