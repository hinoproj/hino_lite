// [MODULE] words | Pure word rules: input cleanup and validation, pitch-accent notation in the reading (P23), morae, pasted-block split (P20), kanji extraction, duplicate key, reveal plan per mode (notes and example folded, P24), quiz steps and option candidates, copy text for paper (P29), search
// [IFACE] layer: domain | in: word drafts, pasted blocks, query strings, a library-membership test -> out: clean words with their accent, accent splits, filled fields, errors, kanji lists, card plans, quiz steps, option texts, copy text | crosses: []
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

// A pasted example line of dashes only ("-", "---") stands for "no example".
const NO_EXAMPLE_RE = /^-+$/;

/**
 * A pasted block in the AI chat's word format (P20), one field per line, empty lines skipped:
 *
 *   少し                                   writing (a kana word repeats its kana here)
 *   すこし                                  reading, with its accent notation (P23)
 *   • a little • a small amount • slightly  meaning (bullets kept)
 *   An adverb or noun …                     notes (every line between the meaning and the last)
 *   少し待ってください。 - Wait a little.     example (the last line: sentence - translation;
 *                                            dashes only, "-" or "---", mean no example)
 *
 * The first line is the writing when it holds a kanji or when the second line is a kana
 * reading; otherwise the block is the older kana format that starts with the reading. A
 * writing equal to its reading is dropped: a kana word is stored without a writing.
 * Null when the text holds fewer than two lines: then it is not a block.
 */
export function parsePaste(text) {
  const rows = String(text == null ? '' : text).split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) return null;
  const hasWriting = HAN_RE.test(rows[0]) || isKana(splitAccent(rows[1]).reading);
  let writing = hasWriting ? rows.shift() : '';
  const [reading = '', meaning = '', ...rest] = rows;
  if (writing === splitAccent(reading).reading) writing = '';
  let example = rest.length ? rest.pop() : '';
  if (NO_EXAMPLE_RE.test(example)) example = '';
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
 *   Japanese → meaning   writing | reading | meaning [notes, example]
 *                        (no writing: reading | meaning [notes, example])
 *   Meaning → Japanese   meaning | reading | writing [notes, example]
 *                        (no writing: meaning | reading [notes, example])
 *
 * [ ] marks the fold.
 *
 * Notes and example always come last: they contain the word, so earlier they
 * would give the answer away in the second mode. They come folded (P24): the
 * last step's `fold` names them and the toggle's label, and the card shows
 * them only when the learner opens it.
 */
export function cardPlan(word, track) {
  const has = (f) => Boolean(clean(word[f]));
  const extras = ['notes', 'example'].filter(has);
  const last = (button, keys) => (extras.length
    ? { button, keys, fold: { label: extras.length > 1 ? 'Notes & example' : FIELD_LABELS[extras[0]], keys: extras } }
    : { button, keys });
  if (track === TRACK_RECALL) {
    return has('writing')
      ? { prompt: 'meaning', steps: [{ button: 'Show reading', keys: ['reading'] }, last('Show kanji', ['writing'])] }
      : { prompt: 'meaning', steps: [last('Show reading', ['reading'])] };
  }
  return has('writing')
    ? { prompt: 'writing', steps: [{ button: 'Show reading', keys: ['reading'] }, last('Show meaning', ['meaning'])] }
    : { prompt: 'reading', steps: [last('Show meaning', ['meaning'])] };
}

/**
 * The quiz's steps for one word (P29): each shows some fields and asks for one more, picked
 * from options (review/quiz.js).
 *
 *   Japanese → meaning   writing -> reading, then writing + reading -> meaning
 *                        (no writing: reading -> meaning)
 *   Meaning → Japanese   meaning -> reading, then meaning + reading -> writing
 *                        (no writing: meaning -> reading)
 *
 * A kana word has one step only, so a quiz never raises it (the owner's call).
 */
export function quizPlan(word, track) {
  const kanji = Boolean(clean(word.writing));
  if (track === TRACK_RECALL) {
    return [{ show: ['meaning'], ask: 'reading' }].concat(kanji ? [{ show: ['meaning', 'reading'], ask: 'writing' }] : []);
  }
  return kanji
    ? [{ show: ['writing'], ask: 'reading' }, { show: ['writing', 'reading'], ask: 'meaning' }]
    : [{ show: ['reading'], ask: 'meaning' }];
}

/**
 * Other words' texts that may stand as wrong options in one quiz step. A word that shows the
 * same as the prompt in every shown field is left out: its answer could be right too (今日 is
 * きょう and こんにち).
 */
export function quizCandidates(word, step, words) {
  return words
    .filter((w) => w.id !== word.id && clean(w[step.ask]) && !step.show.every((k) => clean(w[k]) === clean(word[k])))
    .map((w) => clean(w[step.ask]));
}

/**
 * Words for pen and paper (P29): one per line, kanji, reading and meaning separated by tabs, so
 * a paste makes three columns. A kana word's kanji is "-"; the reading is plain kana (the
 * accent is stored beside it); a line break inside a field becomes "; ".
 */
export function copyText(words) {
  const cell = (value) => clean(value).replace(/\s*[\r\n\t]+\s*/g, '; ');
  return words.map((w) => [cell(w.writing) || '-', cell(w.reading), cell(w.meaning)].join('\t')).join('\n');
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
