/** How a card's number reads: plainly, as something to watch, as a problem. */
export type StatTone = 'plain' | 'warn' | 'danger';

/** One of the six cards across the top of the overview. */
export interface StatCard {
  /** Stable identity: what `each` keys on and what a test looks a card up by. */
  key: string;
  label: string;
  /** Already formatted — a card prints strings, it never does arithmetic. */
  value: string;
  hint: string;
  tone: StatTone;
  /** The full text behind a truncated value, when there is more of it. */
  title?: string;
  /** The screen that shows this number in full, where one is built. */
  href?: string;
}

/** Ascending severity, so two tones over one number can be compared. */
const SEVERITY: Record<StatTone, number> = { plain: 0, warn: 1, danger: 2 };

/** The graver of two tones — a card never talks its own trouble down. */
export function worseTone(a: StatTone, b: StatTone): StatTone {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}
