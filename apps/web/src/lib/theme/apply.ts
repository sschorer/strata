import type { ResolvedTheme } from './mode';

/**
 * The single place the theme touches the DOM: `tokens.css` keys both palettes
 * off this attribute, so setting it repaints the entire app.
 */
export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}
