/**
 * Plugin kinds this build no longer has, and what took over the job. A
 * manifest naming one is a plugin written against an older Strata, not a typo
 * — so the loader says what to do instead rather than listing the kinds that
 * happen to be left.
 */
const RETIRED = new Map<string, string>([
  [
    'ai-provider',
    'an AI provider is a provider instance configured in the app settings ' +
      '(Settings → AI providers), not a plugin',
  ],
]);

/**
 * Why `kind` is no longer a plugin kind, or `null` if it was never one of
 * ours. Checked before the unknown-kind check, which has nothing to suggest.
 *
 * A `Map` rather than an object literal because `kind` is a hand-written
 * string: `"toString"` must reach the unknown-kind error like any other typo,
 * not find a member of `Object.prototype`.
 */
export function retiredKindError(kind: string): string | null {
  return RETIRED.get(kind) ?? null;
}
