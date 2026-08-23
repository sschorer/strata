import { describe, expect, it } from 'vitest';
import type { StageTrouble } from '$lib/stages';
import type { StatCard } from './card';
import { stageCard } from './stage-card';

const card: StatCard = {
  key: 'dead-code',
  label: 'Dead code',
  value: '2',
  hint: '2 files',
  tone: 'warn',
};

const failed: StageTrouble = {
  id: 'acme-language-python',
  status: 'failed',
  reason: 'parser exploded',
};
const skipped: StageTrouble = {
  id: 'acme-language-go',
  status: 'skipped',
  reason: 'its filter matched no file at this revision',
};

describe('stageCard', () => {
  it('leaves a card alone when every stage behind it reported', () => {
    expect(
      stageCard(card, { produced: true, troubles: [], absent: 'no stage' }),
    ).toBe(card);
  });

  it('prints an absence rather than a number nobody produced', () => {
    expect(
      stageCard(card, {
        produced: false,
        troubles: [failed],
        absent: 'no stage produced a graph',
      }),
    ).toMatchObject({ value: '—', hint: '1 stage failed', tone: 'danger' });
  });

  it('is plain about a run that simply planned no such stage', () => {
    // Nothing went wrong: this workbench has no plugin for it.
    expect(
      stageCard(card, {
        produced: false,
        troubles: [],
        absent: 'no stage produced a graph',
      }),
    ).toMatchObject({
      value: '—',
      hint: 'no stage produced a graph',
      tone: 'plain',
    });
  });

  it('keeps what half a run measured, and says it is half', () => {
    expect(
      stageCard(card, {
        produced: true,
        troubles: [skipped],
        absent: 'no stage produced a graph',
      }),
    ).toMatchObject({ value: '2', hint: '2 files · 1 stage did not run' });
  });

  it('never talks its own trouble down to a quieter tone', () => {
    const plain: StatCard = { ...card, tone: 'plain', hint: 'none', value: '0' };

    expect(
      stageCard(plain, {
        produced: true,
        troubles: [failed],
        absent: 'no stage produced a graph',
      }),
    ).toMatchObject({ hint: 'none · 1 stage failed', tone: 'danger' });
  });
});
