import { describe, expect, it } from 'vitest';

import { CHECKPOINT_LABELS, cleanObservations } from '../convex/lib/swingObservations';

describe('CHECKPOINT_LABELS', () => {
  it('spells TOUR PURE, all eight letters, in order', () => {
    // The hand-written list once dropped R in PURE and the screen read TOUPURE.
    const letters = CHECKPOINT_LABELS.map((l) => l.split(' - ')[0].split(' in ')[0]).join('');
    expect(letters).toBe('TOURPURE');
    expect(CHECKPOINT_LABELS).toContain('R in PURE - Release');
  });
});

describe('cleanObservations', () => {
  const all = (detail: string) => CHECKPOINT_LABELS.map((position) => ({ position, detail }));

  it('keeps a real reading, including the checkpoints it could not see', () => {
    const reading = all('Lead arm straight, weight 50/50.');
    reading[5] = { position: 'U in PURE - Impact', detail: 'Not visible - impact falls between frames.' };
    expect(cleanObservations(reading)).toHaveLength(8);
  });

  it('drops the list when nothing at all was visible', () => {
    // What came back for a clip of someone sitting down: the summary already
    // says it is not a golf swing, and eight rows of "Not visible" read as broken.
    expect(cleanObservations(all('Not visible.'))).toBeUndefined();
    expect(cleanObservations(all('Cannot be seen in these frames'))).toBeUndefined();
  });

  it('caps the list at the eight checkpoints and drops empty rows', () => {
    const many = [...all('Solid.'), { position: 'Extra', detail: 'Extra' }, { position: 'Blank', detail: '  ' }];
    expect(cleanObservations(many)).toHaveLength(8);
  });

  it('tolerates whatever the model sends back', () => {
    expect(cleanObservations(undefined)).toBeUndefined();
    expect(cleanObservations('text')).toBeUndefined();
    expect(cleanObservations([{ detail: 'Balanced finish.' }])).toEqual([
      { position: 'Swing', detail: 'Balanced finish.' },
    ]);
  });
});
