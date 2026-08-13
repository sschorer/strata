export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  kind: 'ai-provider';
  /** e.g. "openai", "anthropic", "ollama". */
  id: string;
  /** Models this provider exposes; used to populate the settings UI. */
  listModels(): Promise<string[]>;
  /** Single-shot or streamed chat completion. */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  /** Optional embeddings for repo-wide semantic search / RAG. */
  embed?(texts: string[]): Promise<number[][]>;
}

export function defineAIProvider(p: Omit<AIProvider, 'kind'>): AIProvider {
  return { kind: 'ai-provider', ...p };
}
