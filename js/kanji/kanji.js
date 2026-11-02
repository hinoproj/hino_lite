// [MODULE] kanji | Pure kanji rules: library membership and levels, search, reveal plan per mode, words that use a kanji
// [IFACE] layer: domain | in: kanji characters, query strings, word lists -> out: index entries, booleans, card plans | crosses: []
// [GRAPH] needs: [kanji-index, romaji] | feeds: [kanji-ui, kanji-card, words-ui, sentences-ui, library, selftest] | group: domain
// [STATE] stateless | persists: nothing | raises: nothing

import { LIBRARY, KANJI_INDEX } from './kanji-index.js';
import { toHiragana, katakanaToHiragana, hasLatin } from '../core/romaji.js';

/** Review tracks for kanji. Ids are storage keys: renaming one orphans its scores. */
export const TRACK_READ = 'kanji.read';
export const TRACK_RECALL = 'kanji.recall';
export const TRACKS = [TRACK_READ, TRACK_RECALL];
export const TRACK_INFO = {
  [TRACK_READ]: { label: 'Kanji → meaning', description: 'See the kanji, recall what it means.' },
  [TRACK_RECALL]: { label: 'Meaning → kanji', description: 'See the meaning, picture or write the kanji.' }
};

export const LEVELS = LIBRARY.levels.map((l) => ({ id: l.id, label: l.label, count: l.count }));
const ORDER = new Map(Object.keys(KANJI_INDEX).map((ch, i) => [ch, i]));
const HAN_RE = /\p{Script=Han}/u;

export function isLibraryKanji(ch) {
  return Object.prototype.hasOwnProperty.call(KANJI_INDEX, ch);
}

/** {kanji, meaning, level, terms, readings} from the always-shipped index, or null. */
export function indexEntry(ch) {
  const row = KANJI_INDEX[ch];
  if (!row) return null;
  return { kanji: ch, meaning: row[0], level: row[1], terms: row[2] ? row[2].split('|') : [], readings: row[3] };
}

/** Library order: level, then easier and more useful first. */
export function compareKanji(a, b) {
  return (ORDER.has(a) ? ORDER.get(a) : Infinity) - (ORDER.has(b) ? ORDER.get(b) : Infinity);
}

export function allKanji() {
  return Object.keys(KANJI_INDEX);
}

function wordPrefix(text, q) {
  const lower = String(text || '').toLowerCase();
  return lower.startsWith(q) || lower.split(/[\s,;/-]+/).some((part) => part.startsWith(q));
}

/**
 * Does a kanji match the search box?
 *   - kanji in the query: the kanji is one of them (paste a word, see its kanji)
 *   - kana: a reading contains it
 *   - Latin: a meaning word starts with it ("on" must not match "prison"),
 *     or the query spelled in kana is part of a reading ("gaku")
 */
export function matchesQuery(ch, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const entry = indexEntry(ch);
  if (!entry) return false;
  if (HAN_RE.test(q)) return q.includes(ch);
  const readings = katakanaToHiragana(entry.readings);
  if (!hasLatin(q)) return readings.includes(katakanaToHiragana(q));
  if (wordPrefix(entry.meaning, q) || entry.terms.some((t) => wordPrefix(t, q))) return true;
  const kana = toHiragana(q);
  return !hasLatin(kana) && kana.length > 1 && readings.split(' ').some((r) => r.startsWith(kana));
}

/**
 * The card plan for one kanji in one track (same pattern as words):
 *   Kanji → meaning   glyph | meaning | readings, stroke order, your words
 *   Meaning → kanji   meaning | glyph | readings, stroke order, your words
 */
export function cardPlan(track) {
  if (track === TRACK_RECALL) {
    return { prompt: 'meaning', steps: [{ button: 'Show kanji', keys: ['glyph'] },
      { button: 'Show readings', keys: ['readings', 'strokes', 'words'] }] };
  }
  return { prompt: 'glyph', steps: [{ button: 'Show meaning', keys: ['meaning'] },
    { button: 'Show readings', keys: ['readings', 'strokes', 'words'] }] };
}

/** The learner's words whose writing contains this kanji. */
export function wordsUsing(ch, words) {
  return words.filter((w) => String(w.writing || '').includes(ch));
}
