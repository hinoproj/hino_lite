// [MODULE] sentences | Pure sentence rules: Parse (bracketed readings, trailing translation), pasted-block split (P20), word candidates, validation, search, review tracks, reviewability, reveal plans
// [IFACE] layer: domain | in: typed or pasted sentence text, pasted blocks, drafts, queries -> out: parsed fields, candidate words, errors, filtered lists | crosses: []
// [GRAPH] needs: [romaji] | feeds: [sentences-ui, selftest] | group: domain
// [STATE] stateless | persists: nothing | raises: nothing

import { toHiragana, katakanaToHiragana, hasLatin, isKana } from '../core/romaji.js';

/**
 * A sentence is stored as the learner wrote it; Parse is an explicit button.
 * It reads text such as
 *
 *   質問（しつもん）を聞いて（きいて）もいいですか。 — May I ask a question?
 *
 * and splits it into the sentence (brackets removed), its reading (when every
 * kanji has one), the translation (the Latin or Cyrillic tail, delimiter
 * dropped) and the annotated words: 質問/しつもん, 聞いて/きいて.
 *
 * Which word a bracket belongs to: the text since the previous bracket is the
 * token; its leading non-kanji are stripped (を聞いて -> 聞いて) except the
 * honorific お/ご (お茶). A token holding several kanji runs (日本語を勉強)
 * keeps the earliest start whose kana line up with the reading, so the
 * particle in between decides: 日本語を勉強（べんきょう） -> 勉強, while
 * 落ち着いて（おちついて） stays whole. A bracket after a kana-only token is
 * dropped; a bracket that holds no kana is not a reading and stays as text.
 */

export const FIELDS = ['sentence', 'reading', 'translation', 'notes'];
export const FIELD_LABELS = {
  sentence: 'Sentence', reading: 'Reading', translation: 'Translation', notes: 'Notes'
};

// Review tracks are storage keys (AGENTS.md contract 5): renaming one orphans its scores.
export const TRACK_READ = 'sentences.read';
export const TRACK_RECALL = 'sentences.recall';
export const TRACKS = [TRACK_READ, TRACK_RECALL];
export const TRACK_INFO = {
  [TRACK_READ]: { label: 'Japanese → translation', description: 'See the sentence, recall how it reads and what it means.' },
  [TRACK_RECALL]: { label: 'Translation → Japanese', description: 'See the translation, say or write the sentence.' }
};

const KANJI_RE = /[\p{Script=Han}々〆ヶ]/u;
const HAN_RE = /\p{Script=Han}/u;
const JA_LETTER_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ー]/gu;
const FOREIGN_LETTER_RE = /[\p{Script=Latin}\p{Script=Cyrillic}]/u;
const BRACKET_RE = /[(（[［]([^()（）[\]［］]*)[)）\]］]/g;
// Characters that close the Japanese part when they follow its last letter: 。 after ください, ） after （きく）.
const JA_CLOSERS = '、。，．！？!?.」』）)］]…〜~・"\'';
const DELIMITERS_RE = /^[\s\-–—―:：|｜/=＝→>.,;]+/;
const WRAPPED_RE = /^[(（[［]([\s\S]*)[)）\]］]$/;
const HONORIFICS = 'おご';

function clean(value) {
  return String(value == null ? '' : value).trim();
}

const isKanji = (ch) => KANJI_RE.test(ch);

/** {japanese, translation}: the Latin or Cyrillic tail after the last Japanese letter, delimiter dropped. */
export function splitTranslation(text) {
  const value = clean(text);
  const letters = Array.from(value.matchAll(JA_LETTER_RE));
  if (!letters.length) return { japanese: value, translation: '' };
  const last = letters[letters.length - 1];
  let end = last.index + last[0].length;
  while (end < value.length && JA_CLOSERS.includes(value[end])) end += 1;
  const tail = value.slice(end);
  if (!FOREIGN_LETTER_RE.test(tail)) return { japanese: value, translation: '' };
  let translation = tail.replace(DELIMITERS_RE, '').trim();
  const wrapped = translation.match(WRAPPED_RE);
  if (wrapped) translation = wrapped[1].trim();
  return { japanese: value.slice(0, end).trim(), translation };
}

/** True when the kana in `writing` line up with `reading`; each kanji run stands for one or more kana. */
function aligns(writing, reading) {
  let pattern = '';
  let inRun = false;
  Array.from(writing.replace(/\s+/g, '')).forEach((ch) => {
    if (isKanji(ch)) {
      if (!inRun) pattern += '(.+)';
      inRun = true;
    } else {
      pattern += katakanaToHiragana(ch).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      inRun = false;
    }
  });
  return new RegExp('^' + pattern + '$', 'u').test(katakanaToHiragana(reading.replace(/\s+/g, '')));
}

/** Where the annotated word starts in a token (array of characters), or -1 for a kana-only token. */
function wordStart(token, reading) {
  const starts = [];
  token.forEach((ch, i) => {
    if (!isKanji(ch) || (i > 0 && isKanji(token[i - 1]))) return;
    if (i > 0 && HONORIFICS.includes(token[i - 1])) starts.push(i - 1);
    starts.push(i);
  });
  if (!starts.length) return -1;
  const fit = starts.find((s) => aligns(token.slice(s).join(''), reading));
  return fit === undefined ? token.findIndex(isKanji) : fit;
}

/**
 * Bracketed readings only (no translation split): {text, reading, words}.
 * `reading` is empty unless every kanji got one and no Latin is left.
 */
export function readAnnotations(japanese) {
  const value = String(japanese || '');
  const words = [];
  let text = '';
  let reading = '';
  let cursor = 0;
  for (const match of value.matchAll(BRACKET_RE)) {
    const inner = clean(match[1]);
    if (!isKana(inner)) continue;      // not a reading: the bracket stays as text
    const token = Array.from(value.slice(cursor, match.index).replace(/\s+$/, ''));
    const start = wordStart(token, inner);
    if (start < 0) {
      text += token.join('');
      reading += token.join('');
    } else {
      const writing = token.slice(start).join('');
      words.push({ writing, reading: inner });
      text += token.join('');
      reading += token.slice(0, start).join('') + inner;
    }
    cursor = match.index + match[0].length;
  }
  text += value.slice(cursor);
  reading += value.slice(cursor);
  const usable = !HAN_RE.test(reading) && !hasLatin(reading);
  return { text: text.trim(), reading: usable ? reading.trim() : '', words };
}

/** The Parse button: {sentence, reading, translation, words}. */
export function parse(text) {
  const { japanese, translation } = splitTranslation(text);
  const { text: sentence, reading, words } = readAnnotations(japanese);
  return { sentence, reading, translation, words };
}

/**
 * A pasted block in the AI chat's sentence format (P20), empty lines skipped: the sentence with
 * bracketed readings (read by `readAnnotations`, as Parse reads it), the translation, then the
 * notes (every further line). Null when the text holds fewer than two lines: then it is not a block.
 */
export function parsePaste(text) {
  const rows = String(text == null ? '' : text).split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 2) return null;
  const { text: sentence, reading, words } = readAnnotations(rows[0]);
  return { sentence, reading, translation: rows[1], notes: rows.slice(2).join('\n'), words };
}

/** Whether Parse would change anything (it shows only then). */
export function canParse(text) {
  const parsed = parse(text);
  return parsed.sentence !== clean(text) || Boolean(parsed.translation);
}

/**
 * The words offered after a new sentence is saved, in sentence order, each
 * once: words whose reading is known (`known`, from Parse, or brackets still
 * in the sentence) where they occur, then every other kanji run with an empty
 * reading (お/ご before it included). Kana-only words are not offered.
 */
export function candidates(sentence, known = []) {
  const { text, words } = readAnnotations(sentence);
  const annotated = known.concat(words).filter((w) => w.writing)
    .sort((a, b) => b.writing.length - a.writing.length);
  const chars = Array.from(text);
  const out = [];
  const seen = new Set();
  const push = (writing, reading) => {
    const key = writing + '|' + reading;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ writing, reading });
  };
  let i = 0;
  let taken = 0;      // characters before this index already belong to a word
  while (i < chars.length) {
    const rest = chars.slice(i).join('');
    const hit = annotated.find((w) => rest.startsWith(w.writing));
    if (hit) {
      push(hit.writing, hit.reading);
      i += Array.from(hit.writing).length;
      taken = i;
      continue;
    }
    if (!isKanji(chars[i])) {
      i += 1;
      continue;
    }
    const start = i > taken && HONORIFICS.includes(chars[i - 1]) ? i - 1 : i;
    let end = i;
    while (end < chars.length && isKanji(chars[end])) end += 1;
    push(chars.slice(start, end).join(''), '');
    i = end;
    taken = end;
  }
  return out;
}

/** What a word card made from this sentence gets as its example. */
export function exampleFor(sentence) {
  return [clean(sentence.sentence), clean(sentence.translation)].filter(Boolean).join('\n');
}

/** Trim every field; leftover rōmaji in the reading becomes hiragana. */
export function normalizeDraft(draft) {
  const out = {};
  FIELDS.forEach((f) => { out[f] = clean(draft[f]); });
  out.reading = toHiragana(out.reading).replace(/\s+/g, ' ');
  return out;
}

/** Field -> message for everything that blocks saving; empty object when valid. */
export function validate(sentence) {
  const errors = {};
  if (!sentence.sentence) errors.sentence = 'Write the sentence.';
  if (sentence.reading && (hasLatin(sentence.reading) || HAN_RE.test(sentence.reading))) {
    errors.reading = 'Use kana only — or leave the reading empty.';
  }
  return errors;
}

/** Search across every field; a rōmaji or katakana query also matches the reading it spells. */
export function matchesQuery(sentence, query) {
  const q = clean(query).toLowerCase();
  if (!q) return true;
  const haystack = FIELDS.map((f) => clean(sentence[f]).toLowerCase()).join('\n');
  if (haystack.includes(q)) return true;
  const kana = katakanaToHiragana(toHiragana(q)).replace(/\s+/g, '');
  const reading = katakanaToHiragana(clean(sentence.reading)).replace(/\s+/g, '');
  return Boolean(reading) && !hasLatin(kana) && reading.includes(kana);
}

/** Reviews need a translation: without one there is nothing to check an answer against (P19). */
export function isReviewable(sentence) {
  return Boolean(clean(sentence.sentence)) && Boolean(clean(sentence.translation));
}

/**
 * Reveal plan (P19). Japanese -> translation: the sentence; its reading first when the sentence
 * has kanji and a reading, then the translation with the notes. Translation -> Japanese: the
 * translation, then the sentence with its reading and notes. Notes come last: they may give the
 * answer away.
 */
export function cardPlan(sentence, track) {
  const reading = clean(sentence.reading) && HAN_RE.test(sentence.sentence) ? ['reading'] : [];
  const notes = clean(sentence.notes) ? ['notes'] : [];
  if (track === TRACK_RECALL) {
    return { prompt: 'translation', steps: [{ button: 'Show sentence', keys: ['sentence'].concat(reading, notes) }] };
  }
  const answer = { button: 'Show translation', keys: ['translation'].concat(notes) };
  return { prompt: 'sentence', steps: reading.length ? [{ button: 'Show reading', keys: reading }, answer] : [answer] };
}

/** Newest first, the order the list shows. */
export function sortForList(sentences) {
  return sentences.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
