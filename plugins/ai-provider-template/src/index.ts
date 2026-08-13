import {
  defineAIProvider,
  type ChatMessage,
  type ChatOptions,
} from '@strata/sdk';
import { BASE_URL, DEFAULT_MODEL, authHeaders } from './config.js';

/**
 * AI-provider template.
 *
 * Copy this folder to add a provider (OpenAI, Anthropic, Ollama, Azure, …).
 * Strata calls `chat()` for features like "explain this hotspot" and
 * "generate architecture docs", and the optional `embed()` for repo-wide
 * semantic search (RAG over the analysis DB). Configuration lives in
 * `config.ts`.
 */
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
      headers: { 'content-type': 'application/json', ...authHeaders() },
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
