import { describe, expect, it } from 'vitest';

import {
  MANUAL_CORE,
  clubLetter,
  manualExcerpts,
  manualForQuestion,
  searchManual,
  swingAnalysisGuide,
} from '../convex/lib/manual';
import { MANUAL_SECTIONS } from '../convex/lib/manualContent';

/** The ids of the sections a question retrieves, best first. */
const ids = (q: string) => searchManual(q).map((h) => h.section.id);

describe('the manual as data', () => {
  it('has unique ids and no empty sections', () => {
    const seen = new Set<string>();
    for (const s of MANUAL_SECTIONS) {
      expect(seen.has(s.id), s.id).toBe(false);
      seen.add(s.id);
      expect(s.text.length, s.id).toBeGreaterThan(200);
    }
  });

  it('carries none of the PDF extraction debris', () => {
    for (const s of MANUAL_SECTIONS) {
      // Running page headers, page markers, and the table header rows that
      // extraction left behind as lines of their own.
      expect(s.text, s.id).not.toMatch(/The Ultimate Guide to Master the Game\s+\|\s+\d+/);
      expect(s.text, s.id).not.toMatch(/===== PAGE/);
      expect(s.text, s.id).not.toMatch(/^(Letter|What happens|Checkpoint|Club)$/m);
      expect(s.text, s.id).not.toContain('\ufffd');
    }
  });

  it('keeps every section small enough to send whole', () => {
    // manualExcerpts never sends half a section; one this long would never fit.
    for (const s of MANUAL_SECTIONS) expect(s.text.length, s.id).toBeLessThan(5000);
  });

  it('covers every day of the 90-day program exactly once', () => {
    const days = new Map<number, string>();
    for (const s of MANUAL_SECTIONS) {
      const m = s.title.match(/Days? (\d+)-(\d+)/);
      if (!m) continue;
      for (let d = Number(m[1]); d <= Number(m[2]); d++) {
        expect(days.has(d), `day ${d}`).toBe(false);
        days.set(d, s.id);
      }
    }
    for (let d = 1; d <= 90; d++) expect(days.has(d), `day ${d}`).toBe(true);
  });
});

describe('searchManual', () => {
  it.each([
    ['I keep slicing my driver - where do I start?', ['driver-path', 'iron-faults']],
    ['How do I stop three-putting?', ['putting-stroke', 'tap-in']],
    ['How do I read greens and break?', ['green-reading']],
    ['What is Tour Pure and how do I use it?', ['tour-pure']],
    ['How far should my wedges go? clock positions', ['wedge-drills']],
    ['I hit my irons fat all the time', ['iron-faults', 'low-point']],
    ['topping the ball with my 7 iron', ['iron-faults']],
    ['how do I get out of a bunker', ['bunker']],
    ['I get nervous on the first tee', ['routine-mistakes']],
    ['where do I lay the trainer on the ground', ['lay-tour-pure']],
    ['what letter is my 5 iron at the top', ['club-map']],
    ['how do I hit a draw', ['driver-path', 'shaping']],
    ['can I practice putting at home', ['home-putting']],
    ['what grip pressure should I use', ['grip-setup']],
    ['who founded dominus golf', ['about']],
  ])('%s', (question, expected) => {
    const found = ids(question);
    for (const id of expected) expect(found, `${id} in ${found.join(', ')}`).toContain(id);
  });

  it('goes straight to the program section for a named day', () => {
    expect(ids('what do I do on day 12')[0]).toBe('program-p2');
    expect(ids('day 50 of the program')[0]).toBe('program-p4a');
    expect(ids('Day 90?')[0]).toBe('program-p7');
  });

  it('answers a technique question from the lessons, not the practice schedule', () => {
    // The schedules mention draws and bunkers too, by ball count. Unless the
    // golfer asks about the program, the chapter that teaches it comes first.
    expect(ids('how do I hit a draw')[0]).not.toMatch(/^program-/);
    expect(ids('how do I get out of a bunker')[0]).toBe('bunker');
  });

  it('translates the older P-numbers the drill cards still use', () => {
    expect(ids('what is P7')).toEqual(expect.arrayContaining(['nine-to-three']));
    expect(ids('I lose it at P4')).toEqual(expect.arrayContaining(['checkpoints']));
  });

  it('finds nothing for a question that is not about golf', () => {
    expect(searchManual('')).toEqual([]);
    expect(searchManual('the and of')).toEqual([]);
  });
});

describe('manualExcerpts', () => {
  it('stays inside its budget and sends whole sections only', () => {
    const text = manualExcerpts('I keep slicing my driver', 3000);
    expect(text.length).toBeLessThanOrEqual(3000);
    const sections = text.split('\n\n[');
    for (const s of sections) {
      const title = s.match(/ - ([^\]]+)\]/)?.[1];
      const section = MANUAL_SECTIONS.find((m) => m.title === title);
      expect(section, title).toBeDefined();
      expect(s).toContain(section!.text);
    }
  });

  it('is empty when nothing matches, so the prompt carries no empty heading', () => {
    expect(manualExcerpts('')).toBe('');
  });
});

describe('MANUAL_CORE', () => {
  it('states the numbers the current edition changed', () => {
    // The persona and drill cards were written for an older edition; these
    // are the facts the coach must now get right regardless.
    expect(MANUAL_CORE).toContain('7:30, 9:00 and 10:30');
    expect(MANUAL_CORE).toContain('P7 is U in PURE');
    expect(MANUAL_CORE).toContain('The 100 Rule');
  });

  it('gives every named drill the reps the book gives it', () => {
    // A reply that names a drill but invents its volume was the first thing a
    // live check caught: "the 9 O'Clock to 3 O'Clock Drill, 10 reps".
    expect(MANUAL_CORE).toMatch(/9 O'Clock to 3 O'Clock Drill - [^\n]*5 sets of 20/);
    expect(MANUAL_CORE).toMatch(/Low Point Drill - [^\n]*pass 8 of 10/);
    expect(MANUAL_CORE).toMatch(/Face Check - [^\n]*3 sets of 10/);
    expect(MANUAL_CORE).toMatch(/Roll It to the Center Checkpoint - [^\n]*out of 30/);
  });

  it('agrees with the book on every Club Map letter', () => {
    const map = MANUAL_SECTIONS.find((s) => s.id === 'club-map')!.text;
    for (const line of [
      'T: Driver.',
      'O: Fairway woods.',
      'P: Mid irons (6–7).',
      'E: Sand and lob wedges.',
    ]) {
      expect(map).toContain(line);
    }
  });
});

describe('clubLetter', () => {
  it.each([
    ['Driver', 'T'],
    ['3-Wood', 'O'],
    ['5-Wood', 'O'],
    ['4-Iron', 'R in TOUR'],
    ['5-Iron', 'R in TOUR'],
    ['6-Iron', 'P'],
    ['7-Iron', 'P'],
    ['8-Iron', 'U in PURE'],
    ['9-Iron', 'U in PURE'],
    ['PW', 'R in PURE'],
    ['GW', 'R in PURE'],
    ['SW', 'E'],
    ['LW', 'E'],
  ])('%s is %s', (club, letter) => {
    expect(clubLetter(club)).toBe(letter);
  });

  it('names both letters for a hybrid, whose number it does not know', () => {
    expect(clubLetter('Hybrid')).toContain('U in TOUR');
    expect(clubLetter('Hybrid')).toContain('R in TOUR');
  });

  it('has no letter for the putter', () => {
    expect(clubLetter('Putter')).toBeNull();
  });
});

describe('manualForQuestion', () => {
  it('leaves a specific question alone', () => {
    // Working on putting, asking about a slice: they want the slice.
    const text = manualForQuestion('I keep slicing my driver', 'putting');
    expect(text).toContain('Driver swing path, fairway woods and hybrids');
    expect(text).not.toContain('The Four Fundamental Putting Principles');
  });

  it('falls back to the phase for a vague one', () => {
    expect(manualForQuestion('What should I work on today?', 'putting')).toMatch(/putt/i);
  });
});

describe('swingAnalysisGuide', () => {
  it('names the Club Map letter for the club being analysed', () => {
    expect(swingAnalysisGuide('7-Iron')).toContain('puts P behind the trail shoulder');
    expect(swingAnalysisGuide('Driver')).toContain('puts T behind the trail shoulder');
  });

  it('leaves the letter out for a club that has none', () => {
    expect(swingAnalysisGuide('Putter')).not.toContain('Club Map');
    expect(swingAnalysisGuide('Putter')).toContain('T-O-U-R-P-U-R-E');
  });

  it('prescribes only drills the manual actually has', () => {
    const guide = swingAnalysisGuide('7-Iron');
    for (const drill of ['Low Point Drill', "9 O'Clock to 3 O'Clock Drill", 'Turn Check']) {
      expect(guide).toContain(drill);
      const inBook = MANUAL_SECTIONS.some((s) => s.text.toLowerCase().includes(drill.toLowerCase()));
      expect(inBook, drill).toBe(true);
    }
  });
});

describe('what the first live evaluation caught', () => {
  it('reads a short follow-up in the light of the question before it', () => {
    // On its own words "reps" matches the mastery timeline. After a question
    // about a slice, it is asking about the slice drill.
    const text = manualForQuestion('How many reps should I do?', 'putting', [
      'I keep slicing my driver. Where do I start?',
    ]);
    expect(text).toContain('Driver swing path');
    expect(text).not.toContain('How long each skill takes to master');
  });

  it('still reads a full new question on its own words, history or not', () => {
    const text = manualForQuestion('How do I get out of a greenside bunker?', 'putting', [
      'I keep slicing my driver.',
    ]);
    expect(text).toContain('Bunker play');
  });

  it('gives small talk no passages', () => {
    for (const q of ['Thanks, that really helped!', 'ok', 'Hi there', 'perfect, will do']) {
      expect(manualForQuestion(q, 'putting'), q).toBe('');
    }
  });

  it('finds course management for a risk decision', () => {
    expect(ids('Should I go for the green over water from 200 yards?')).toContain('course-management');
  });

  it('finds hanging back for a wedge that flies high and short', () => {
    expect(ids('My ball flight is too high with my wedges and I come up short.')).toContain('pitching');
  });

  it('tells the coach which swing size a yardage is, and not to fix a yardage to a clock position', () => {
    expect(MANUAL_CORE).toContain('70 yards is a half swing');
    expect(MANUAL_CORE).toContain('Never give a fixed yardage for a clock position');
  });

  it('tells the coach the Low Point Drill is not the slice drill', () => {
    expect(MANUAL_CORE).toMatch(/Low Point Drill fixes contact[^.;]*, not a slice/);
  });
});
