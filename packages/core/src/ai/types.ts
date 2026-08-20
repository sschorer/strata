import type { AIProviderInstance } from '../settings/index.js';

/** One turn of a conversation with a provider. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** One of the instance's `models`; the runtime picks the first when unset. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * What talking to a configured provider costs a caller: a model list, a chat
 * turn, and embeddings where the agent offers them. Every call names the
 * `AIProviderInstance` it runs, because a provider is *configuration* — a
 * binary, its arguments, its environment — rather than a registered object,
 * and one runtime serves every instance the app settings hold.
 *
 * Internal to the core on purpose (docs/adr/0013): this is the seam a future
 * subprocess runtime implements, not a contract a plugin may satisfy. Nothing
 * in an analysis may call it — a stage that asks a model is neither offline
 * nor reproducible, and the incremental cache would serve its answer forever.
 * The AI features that will use it read a *finished* report.
 */
export interface ProviderRuntime {
  listModels(provider: AIProviderInstance): Promise<string[]>;
  chat(
    provider: AIProviderInstance,
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): Promise<string>;
  embed?(provider: AIProviderInstance, texts: string[]): Promise<number[][]>;
}
