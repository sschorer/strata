import { troubleLine, type StageTrouble } from '$lib/stages';
import { worseTone, type StatCard, type StatTone } from './card';

/** What became of the stages behind one card's number. */
export interface StageState {
  /** Whether any stage of the card's output type produced anything at all. */
  produced: boolean;
  /** The ones that produced nothing, and how each ended. */
  troubles: readonly StageTrouble[];
  /** The hint for a run that planned no such stage — not a failure, an absence. */
  absent: string;
}

/**
 * A card, told what became of the stages its number came from.
 *
 * A stat card is a number and a caption, and a number nobody produced must
 * never be printed as zero: *Dead code* reading "0" for a run whose only
 * language module threw is the exact failure the stage entry exists to prevent
 * (`docs/adr/0015`). So a card with nothing behind it prints an em dash and
 * says what happened instead.
 *
 * A run where some of them reported and some did not keeps its number — half a
 * repository's dead code is still worth seeing — and gains the hint saying it
 * is only half, because a count that quietly shrank is the more dangerous of
 * the two mistakes.
 */
export function stageCard(card: StatCard, state: StageState): StatCard {
  const { produced, troubles, absent } = state;
  const tone: StatTone = troubles.some((trouble) => trouble.status === 'failed')
    ? 'danger'
    : 'warn';

  if (produced) {
    if (troubles.length === 0) return card;
    return {
      ...card,
      hint: card.hint
        ? `${card.hint} · ${troubleLine(troubles)}`
        : troubleLine(troubles),
      tone: worseTone(card.tone, tone),
    };
  }

  return {
    ...card,
    value: '—',
    hint: troubles.length > 0 ? troubleLine(troubles) : absent,
    tone: troubles.length > 0 ? tone : 'plain',
  };
}
