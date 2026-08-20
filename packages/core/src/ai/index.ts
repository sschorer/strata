/**
 * The call surface a provider runtime implements — internal to `@strata/core`
 * and deliberately absent from its barrel and from `@strata/sdk`, so that
 * spawning a coding agent stays a core concern rather than a plugin kind.
 *
 * What a provider *is* lives one directory over, in `settings/`: an
 * `AIProviderInstance` is the declaration these calls are made against.
 */
export type { ChatMessage, ChatOptions, ProviderRuntime } from './types.js';
