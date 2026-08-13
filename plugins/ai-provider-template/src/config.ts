/**
 * Provider configuration, read from the environment (see .env.example) so no
 * keys are committed. For a fully-local setup, point AI_BASE_URL at an Ollama
 * server (http://localhost:11434/v1) and leave AI_API_KEY blank.
 */
export const BASE_URL = process.env.AI_BASE_URL ?? '';
export const API_KEY = process.env.AI_API_KEY ?? '';
export const DEFAULT_MODEL = process.env.AI_MODEL ?? '';

/** Auth header, omitted entirely when no key is set (local models need none). */
export function authHeaders(): Record<string, string> {
  return API_KEY ? { authorization: `Bearer ${API_KEY}` } : {};
}
