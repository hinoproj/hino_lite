// [MODULE] words | Pure word rules: input cleanup and validation, kanji extraction, duplicate key, reveal plan per mode, search
// [IFACE] layer: domain | in: word drafts, query strings, a library-membership test -> out: clean words, errors, kanji lists, card plans | crosses: []
// [GRAPH] needs: [romaji] | feeds: [words-ui, sentences-ui, kanji-card, kanji-ui, selftest] | group: domain
// [STATE] stateless | persists: nothing | raises: nothing

import { toHiragana, katakanaToHiragana, hasLatin, isKana } from '../core/romaji.js';

/** Review tracks for words. Ids are storage keys: renaming one orphans its scores. */
export const TRACK_READ = 'words.read';
export const TRACK_RECALL = 'words.recall';
export const TRACKS = [TRACK_READ, TRACK_RECALL];
export const TRACK_INFO = {
  [TRACK_READ]: { label: 'Japanese → meaning', description: 'See the word, recall how it reads and what it means.' },
  [TRACK_RECALL]: { label: 'Meaning → Japanese', description: 'See the meaning, recall the word.' }
};

export const FIELDS = ['writing', 'reading', 'meaning', 'example', 'notes'];
export const FIELD_LABELS = {
  writing: 'Kanji', reading: 'Reading', meaning: 'Meaning', example: 'Example', notes: 'Notes'
};

// 々 repeats the previous kanji; it is not a kanji to learn.
const ITERATION_MARK = '々';
const HAN_RE = /\p{Script=Han}/u;

function clean(value) {
  return String(value == null ? '' : value).trim();
}

/**
 * Tidy a draft before saving: trims every field and turns any rōmaji left in
 * the reading into hiragana (the learner may not have tapped a suggestion).
 */
export function normalizeDraft(draft) {
  const out = {};
  FIELDS.forEach((f) => { out[f] = clean(draft[f]); });
  out.reading = toHiragana(out.reading).replace(/\s+/g, ' ');
  return out;
}

/** Field -> message for everything that blocks saving; empty object when valid. */
export function validate(word) {
  const errors = {};
  if (!word.reading) errors.reading = 'Type how the word reads.';
  else if (hasLatin(word.reading) || !isKana(word.reading)) errors.reading = 'Use kana only — tap a suggestion.';
  if (!word.meaning) errors.meaning = 'Write what the word means.';
  return errors;
}

/** Same writing and reading = the same word. */
export function duplicateKey(word) {
  return clean(word.writing) + '|' + clean(word.reading);
}

/** The library kanji in a writing, in order, each once. `isLibraryKanji(ch)` decides membership. */
export function extractKanji(writing, isLibraryKanji) {
  const seen = new Set();
  const out = [];
  Array.from(String(writing || '')).forEach((ch) => {
    if (ch === ITERATION_MARK || seen.has(ch) || !HAN_RE.test(ch) || !isLibraryKanji(ch)) return;
    seen.add(ch);
    out.push(ch);
  });
  return out;
}

/** Headline of a word in lists: the writing when there is one, else the reading. */
export function headline(word) {
  return word.writing || word.reading;
}

/**
 * The card plan for one word in one track: what the prompt shows and what
 * each press of the main button reveals. Fields that are empty are dropped,
 * so a word without notes simply reveals less.
 *
 *   Japanese → meaning   writing | reading | meaning, example, notes
 *                        (no writing: reading | meaning, example, notes)
 *   Meaning → Japanese   meaning | reading | writing, example, notes
 *                        (no writing: meaning | reading, example, notes)
 *
 * Example and notes always come last: they contain the word, so earlier they
 * would give the answer away in the second mode.
 */
export function cardPlan(word, track) {
  const has = (f) => Boolean(clean(word[f]));
  const extras = ['example', 'notes'].filter(has);
  if (track === TRACK_RECALL) {
    return has('writing')
      ? { prompt: 'meaning', steps: [{ button: 'Show reading', keys: ['reading'] },
        { button: 'Show kanji', keys: ['writing'].concat(extras) }] }
      : { prompt: 'meaning', steps: [{ button: 'Show reading', keys: ['reading'].concat(extras) }] };
  }
  return has('writing')
    ? { prompt: 'writing', steps: [{ button: 'Show reading', keys: ['reading'] },
      { button: 'Show meaning', keys: ['meaning'].concat(extras) }] }
    : { prompt: 'reading', steps: [{ button: 'Show meaning', keys: ['meaning'].concat(extras) }] };
}

/** Search across every field; a rōmaji or katakana query also matches the reading it spells. */
export function matchesQuery(word, query) {
  const q = clean(query).toLowerCase();
  if (!q) return true;
  const haystack = FIELDS.map((f) => clean(word[f]).toLowerCase()).join('\n');
  if (haystack.includes(q)) return true;
  const reading = katakanaToHiragana(clean(word.reading));
  const kana = katakanaToHiragana(toHiragana(q));
  return !hasLatin(kana) && reading.includes(kana);
}

/** Newest first, the order the list shows. */
export function sortForList(words) {
  return words.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
