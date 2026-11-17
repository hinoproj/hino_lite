// [MODULE] words | Pure word rules: input cleanup and validation, pitch-accent notation in the reading (P23), morae, pasted-block split (P20), kanji extraction, duplicate key, reveal plan per mode, search
// [IFACE] layer: domain | in: word drafts, pasted blocks, query strings, a library-membership test -> out: clean words with their accent, accent splits, filled fields, errors, kanji lists, card plans | crosses: []
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

export const FIELDS = ['writing', 'reading', 'meaning', 'notes', 'example'];
export const FIELD_LABELS = {
  writing: 'Kanji', reading: 'Reading', meaning: 'Meaning', example: 'Example', notes: 'Notes'
};

// 々 repeats the previous kanji; it is not a kanji to learn.
const ITERATION_MARK = '々';
const HAN_RE = /\p{Script=Han}/u;

// Small kana that share a mora with the kana before them (きょ, ファ). っ, ん and ー are morae of their own.
const SMALL_KANA = 'ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ';
// "とけい [flat]": the word has no accented mora. Matched before rōmaji conversion turns "flat" into kana.
const FLAT_RE = /\s*[[［]\s*flat\s*[\]］]\s*$/i;
// "[きょ]う": the bracket marks the accented mora; one pair, kana inside.
const MARK_RE = /^([^[\]［］]*)[[［]([^[\]［］]+)[\]］]([^[\]［］]*)$/;
const BRACKET_RE = /[[\]［］]/;
export const FLAT_MARK = '[flat]';

function clean(value) {
  return String(value == null ? '' : value).trim();
}

/** The morae of a kana string: きょう -> きょ, う; いっしょ -> い, っ, しょ. */
export function morae(kana) {
  const out = [];
  Array.from(String(kana || '')).forEach((ch) => {
    if (SMALL_KANA.includes(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  });
  return out;
}

/**
 * The reading field's pitch-accent notation (P23), as the AI chat gem writes it:
 *
 *   とけい [flat]   no accented mora           -> accent 0
 *   [きょ]う        the bracket marks a mora   -> accent 1 (its position, from 1)
 *   とけい          not known (or no accent)   -> accent null
 *
 * A bracket around more than one mora marks the last of them. Rōmaji is
 * converted as in any reading ("[kyo]u"). A reading with a bracket left over
 * (two pairs, one unclosed, [flat] after a mark) keeps it, so `validate` refuses it.
 */
export function splitAccent(text) {
  const raw = clean(text);
  const flat = FLAT_RE.test(raw);
  const body = toHiragana(raw.replace(FLAT_RE, '')).replace(/\s+/g, ' ').trim();
  if (flat) return { reading: body, accent: 0 };
  const m = MARK_RE.exec(body);
  if (!m || !m[2].trim()) return { reading: body, accent: null };
  const reading = (m[1] + m[2].trim() + m[3]).trim();
  const end = Array.from((m[1] + m[2].trim()).trimStart()).length;
  const units = morae(reading);
  let seen = 0;
  for (let i = 0; i < units.length; i++) {
    seen += Array.from(units[i]).length;
    if (seen >= end) return { reading, accent: i + 1 };
  }
  return { reading, accent: null };
}

/** Back to the notation, for the form: what `splitAccent` reads gives the same accent again. */
export function formatAccent(reading, accent) {
  const text = clean(reading);
  if (accent === 0 && text) return text + ' ' + FLAT_MARK;
  const split = accentSplit(text, accent);
  return split ? split.before + '[' + split.mora + ']' + split.after : text;
}

/**
 * The reading around its accented mora, for showing it highlighted:
 * {before, mora, after}; null when there is nothing to highlight (flat, not
 * known, or a position the reading does not have).
 */
export function accentSplit(reading, accent) {
  if (!Number.isInteger(accent) || accent < 1) return null;
  const units = morae(clean(reading));
  if (accent > units.length) return null;
  return { before: units.slice(0, accent - 1).join(''), mora: units[accent - 1], after: units.slice(accent).join('') };
}

/**
 * How a reading shows its accent: `marked` (the split around the bold mora, or
 * null) and `flat` (true only for a word known to be flat, which gets a "flat"
 * label; a reading whose accent is not known shows neither).
 */
export function accentView(reading, accent) {
  return { marked: accentSplit(reading, accent), flat: accent === 0 };
}

/** The text of a reading without its [flat] mark, and whether it had one (rōmaji suggestions work on the rest). */
export function splitFlatMark(text) {
  const value = String(text == null ? '' : text);
  return FLAT_RE.test(value) ? { body: value.replace(FLAT_RE, ''), flat: true } : { body: value, flat: false };
}

/**
 * A pasted block in the AI chat's word format (P20), one field per line, empty lines skipped:
 *
 *   少し                                   writing (only when the line holds a kanji;
 *   すこし                                  reading   a kana word starts with its reading)
 *   • a little • a small amount • slightly  meaning (bullets kept)
 *   An adverb or noun …                     notes (every line between the meaning and the last)
 *   少し待ってください。 - Wait a little.     example (the last line: sentence - translation)
 *
 * Null when the text holds fewer than two lines: then it is not a block.
 */
export function parsePaste(text) {
  const rows = String(text == null ? '' : text).split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) return null;
  const writing = HAN_RE.test(rows[0]) ? rows.shift() : '';
  const [reading = '', meaning = '', ...rest] = rows;
  const example = rest.length ? rest.pop() : '';
  return { writing, reading, meaning, notes: rest.join('\n'), example };
}

/**
 * Tidy a draft before saving: trims every field, turns any rōmaji left in the
 * reading into hiragana (the learner may not have tapped a suggestion) and
 * takes the accent notation out of the reading into `accent`.
 */
export function normalizeDraft(draft) {
  const out = {};
  FIELDS.forEach((f) => { out[f] = clean(draft[f]); });
  const { reading, accent } = splitAccent(out.reading);
  out.reading = reading;
  out.accent = accent;
  return out;
}

/** Field -> message for everything that blocks saving; empty object when valid. */
export function validate(word) {
  const errors = {};
  if (!word.reading) errors.reading = 'Type how the word reads.';
  else if (BRACKET_RE.test(word.reading)) errors.reading = 'Put [ ] around one part of the reading, or end it with ' + FLAT_MARK + '.';
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
 *   Japanese → meaning   writing | reading | meaning, notes, example
 *                        (no writing: reading | meaning, notes, example)
 *   Meaning → Japanese   meaning | reading | writing, notes, example
 *                        (no writing: meaning | reading, notes, example)
 *
 * Notes and example always come last: they contain the word, so earlier they
 * would give the answer away in the second mode.
 */
export function cardPlan(word, track) {
  const has = (f) => Boolean(clean(word[f]));
  const extras = ['notes', 'example'].filter(has);
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
