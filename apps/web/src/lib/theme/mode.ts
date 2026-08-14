/** What the user picked. `system` defers to the OS preference. */
export type ThemeMode = 'dark' | 'light' | 'system';

/** What actually gets painted — `system` is resolved away first. */
export type ResolvedTheme = 'dark' | 'light';

/** The order the appearance switch renders them in. */
export const THEME_MODES = [
  'dark',
  'light',
  'system',
] as const satisfies readonly ThemeMode[];

/** Guards the value read back from storage, which is user-editable. */
export function isThemeMode(value: unknown): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value as string);
}

export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean,
): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}
