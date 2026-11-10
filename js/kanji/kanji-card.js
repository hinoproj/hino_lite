// [MODULE] kanji-card | Kanji card sheet: glyph, progress panel with list actions, stroke order, readings with components, your words and sentences, example words with pitch accent
// [IFACE] layer: presentation | in: a kanji character, an onChange callback -> out: the card in the sheet, enrollment/known changes | crosses: [browser DOM]
// [GRAPH] needs: [kanji, library, words, review, review-ui, storage, shell, dom, words-ui, sentences-ui] | feeds: [kanji-ui, words-ui] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

/**
 * Ported from JLPT_coach's kanji card (not verbatim). The card keeps its own
 * small view stack: tapping a component opens that kanji, tapping an example
 * word opens the word view, and "←" walks back; the sheet itself has a single
 * back entry, so Android's back button closes the card. The learner's own
 * words and sentences open their sheets in place of the card.
 */

import * as K from './kanji.js';
import * as library from './library.js';
import * as W from '../words/words.js';
import * as R from '../review/review.js';
import { trackRow } from '../review/review-ui.js';
import * as store from '../core/storage.js';
import * as shell from '../core/shell.js';
import { h, ja, button, confirmAction, toast } from '../core/dom.js';
import { openWordForm, openWordView } from '../words/words-ui.js';
import { openSentenceView } from '../sentences/sentences-ui.js';

const WORDS_SHOWN = 8;
const SENTENCES_SHOWN = 3;

let stack = [];          // [{type: 'kanji', ch} | {type: 'word', ch, word}]
let onChange = null;
let renderToken = 0;

/** Open a kanji's card. `onChanged()` runs after the learner adds, removes or marks it. */
export function openKanjiCard(ch, { onChanged } = {}) {
  stack = [{ type: 'kanji', ch }];
  onChange = onChanged || null;
  render();
}

function push(view) {
  stack.push(view);
  render();
}

function pop() {
  stack.pop();
  render();
}

async function render() {
  const token = ++renderToken;
  const view = stack[stack.length - 1];
  const node = view.type === 'kanji' ? await kanjiView(view.ch) : wordView(view);
  if (token !== renderToken) return;     // a newer view was requested meanwhile
  shell.openSheet(node, { label: view.type === 'kanji' ? 'Kanji ' + view.ch : view.word[0] });
}

function changed() {
  if (onChange) onChange();
  render();
}

function head() {
  return h('div', { class: 'sheet-head' },
    stack.length > 1 ? button('← Back', pop, 'icon-btn ghost', { id: 'btn-card-back' }) : h('span'),
    button('✕', shell.closeSheet, 'icon-btn ghost', { 'aria-label': 'Close', id: 'btn-card-close' }));
}

function zone(label, content, extraClass) {
  return h('section', { class: 'zone' + (extraClass ? ' ' + extraClass : '') },
    h('div', { class: 'zone-label' }, label), content);
}

// --- Kanji view ------------------------------------------------------------

/**
 * Layout: hero (glyph, meaning, progress panel) -> stroke order beside the
 * readings panel (readings, components) -> the learner's own words
 * and sentences -> example words. The progress panel sits beside the meaning
 * on wide sheets and drops under the glyph on a phone (kanji.css).
 */
async function kanjiView(ch) {
  const entry = K.indexEntry(ch);
  if (!entry) return h('div', { class: 'kanji-card' }, head(), h('p', { class: 'muted' }, ch + ' is not in the kanji library.'));
  const [info, svg] = await Promise.all([library.detail(ch), library.strokeSvg(ch)]);
  const levelLabel = K.LEVELS.find((l) => l.id === entry.level).label;
  const yourWords = K.wordsUsing(ch, store.listWords());
  const yourSentences = K.sentencesUsing(ch, store.listSentences());
  const alt = info ? info.alt : [];

  return h('div', { class: 'kanji-card', id: 'kanji-card', dataset: { kanji: ch } },
    head(),
    h('div', { class: 'card-hero' },
      ja(ch, 'hero-glyph', 'div'),
      h('div', { class: 'hero-text' },
        h('div', { class: 'hero-meta' }, h('span', { class: 'level-badge' }, levelLabel), ' ', entry.meaning),
        alt.length ? h('div', { class: 'hero-alt' }, 'also: ' + alt.join(', ')) : null),
      progressPanel(ch)),

    info ? null : h('p', { class: 'notice' }, 'The kanji library has not finished downloading yet — open the Kanji tab to finish it.'),

    info ? h('div', { class: 'card-main' },
      svg ? zone('Stroke order', h('div', { class: 'strokes', html: svg, role: 'img', 'aria-label': 'Stroke order of ' + ch }), 'strokes-zone') : null,
      zone('Readings', [readingsNode(info),
        partsBlock('Components', info.comp, 'component-parts')], 'readings-zone')) : null,

    yourWords.length || yourSentences.length ? h('div', { class: 'card-row' },
      yourWords.length
        ? zone('In your words', h('div', { class: 'chips' }, yourWords.map((w) =>
          button(ja(W.headline(w)), () => openWordView(w.id), 'chip', { 'data-word-id': w.id }))))
        : null,
      yourSentences.length
        ? zone('In your sentences', expandable(yourSentences, SENTENCES_SHOWN, (s) => sentenceRow(s, ch),
          'card-sentences', (n) => 'Show all ' + n + ' sentences', 'btn-more-sentences'))
        : null) : null,

    info && info.words.length
      ? zone('Example words (' + info.words.length + ')', expandable(info.words, WORDS_SHOWN, (word) =>
        h('button', { type: 'button', class: 'example-row', onclick: () => push({ type: 'word', ch, word }) },
          ja(word[0], 'w'), ja(word[1], 'r'), h('span', { class: 'm' }, word[2].split(';')[0])),
        'example-words', (n) => 'Show all ' + n + ' words', 'btn-more-words'), 'examples-zone')
      : null);
}

/** Both review directions with their state, and the list actions. */
function progressPanel(ch) {
  const enrolled = store.isEnrolled(ch);
  const known = R.isKnown(K.TRACKS.map((t) => store.reviewStats(t, ch).score));
  return h('section', { class: 'progress-panel' },
    enrolled ? K.TRACKS.map((t) => trackRow(K.TRACK_INFO[t].label, R.stateOf(store.reviewStats(t, ch).score))) : h('p', { class: 'muted' }, 'Not in your kanji yet.'),
    h('div', { class: 'actions' },
      enrolled
        ? button('Remove', () => removeKanji(ch), 'ghost small', { id: 'btn-kanji-remove' })
        : button('+ Add to my kanji', () => addKanji(ch), 'primary small', { id: 'btn-kanji-add' }),
      known ? null : button('Mark as known', () => markKnown(ch), 'ghost small', { id: 'btn-kanji-known' })));
}

export function readingsNode(info) {
  if (!info.on.length && !info.kun.length) return h('p', { class: 'muted' }, 'No readings listed.');
  return h('div', { class: 'readings' },
    info.on.map((r) => h('div', { class: 'reading-pill on' }, h('span', { class: 'rt' }, 'On'), ja(r, 'rv'))),
    info.kun.map((r) => h('div', { class: 'reading-pill kun' }, h('span', { class: 'rt' }, 'Kun'), ja(r, 'rv'))));
}

/**
 * Parts as [glyph, meaning, link] chips. `link` is the library kanji a tap opens: the glyph itself
 * or, for a variant shape, its full form (亻 opens 人); a part without one is a plain label.
 * No separate radical row: the kanji's radical is almost always one of its components already.
 */
function partsBlock(label, parts, listClass) {
  if (!parts.length) return null;
  return [h('div', { class: 'sub-label' }, label), h('div', { class: 'parts ' + listClass }, parts.map(([glyph, meaning, link]) => {
    const open = link && link !== stack[stack.length - 1].ch && K.isLibraryKanji(link);
    const content = [ja(glyph, 'part-glyph'), meaning ? h('span', { class: 'part-meaning' }, meaning) : null];
    return open
      ? button(content, () => push({ type: 'kanji', ch: link }), 'part-chip rc-link', { title: 'Open ' + link, 'data-kanji': link })
      : h('span', { class: 'part-chip' }, content);
  }))];
}

/** A learner's sentence with this kanji picked out; the text goes in as text nodes. */
function sentenceRow(sentence, ch) {
  const pieces = sentence.sentence.split(ch);
  const text = pieces.flatMap((piece, i) => (i ? [h('mark', null, ch), piece] : [piece]));
  return h('button', { type: 'button', class: 'card-sentence', dataset: { sentenceId: sentence.id },
    onclick: () => openSentenceView(sentence.id) },
  h('span', { class: 'cs-text', lang: 'ja' }, text),
  sentence.translation ? h('span', { class: 'cs-translation' }, sentence.translation) : null);
}

/** The first `shown` items, and a button that reveals the rest. */
function expandable(items, shown, render, listClass, moreLabel, moreId) {
  const list = h('div', { class: listClass });
  const fill = (count) => list.replaceChildren(...items.slice(0, count).map(render));
  fill(shown);
  if (items.length <= shown) return list;
  const more = button(moreLabel(items.length), () => {
    fill(items.length);
    more.remove();
  }, 'ghost small', { id: moreId });
  return h('div', null, list, more);
}

// --- Example word view ----------------------------------------------------

function wordView({ word }) {
  const [writing, reading, gloss, rank, pitch, senses] = word;
  const mine = store.listWords().find((w) => W.duplicateKey(w) === W.duplicateKey({ writing, reading }));
  const meanings = senses.length ? senses : (gloss ? [gloss] : []);
  return h('div', { class: 'kanji-card word-sub', id: 'example-word' },
    head(),
    h('div', { class: 'hero' }, ja(writing, 'hero-word', 'div'),
      h('div', { class: 'hero-meta' }, ja(reading), rank ? ' · rank ' + rank : '')),
    pitch.length ? zone('Pitch accent', h('div', { class: 'pitch', html: pitch.map((p) => pitchSvg(reading, p)).join('') })) : null,
    meanings.length ? zone('Meanings', h('ol', { class: 'senses' }, meanings.map((m) => h('li', null, m)))) : null,
    h('div', { class: 'actions' },
      mine
        ? button('In your words ✓', () => openWordView(mine.id), 'ghost', { id: 'btn-open-my-word' })
        : button('+ Add to my words', () => {
          shell.closeSheetNow();
          openWordForm({ writing, reading, meaning: gloss }, { swap: true });
        }, 'primary', { id: 'btn-add-example' })));
}

/**
 * One pitch-accent pattern ("LHH") as a line-and-dot diagram over the kana:
 * one letter per mora plus a trailing letter for the particle after the word
 * (drawn hollow), L low, H high. Kana and pattern come from the built library.
 */
export function pitchSvg(reading, pattern) {
  const kana = Array.from(reading);
  const n = Math.min(pattern.length, kana.length + 1);
  const step = 28;
  const pad = 14;
  const width = pad * 2 + step * Math.max(n - 1, 1);
  const pts = Array.from({ length: n }, (_, i) => ({ x: pad + step * i, y: pattern[i] === 'H' ? 10 : 30, trailing: i === kana.length }));
  const line = pts.map((p) => p.x + ',' + p.y).join(' ');
  const dots = pts.map((p) => '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (p.trailing ? 3 : 4) + '"' +
    (p.trailing ? ' fill="none" stroke="currentColor" stroke-width="1.5"' : ' fill="currentColor"') + '/>').join('');
  const labels = kana.map((c, i) => '<text x="' + (pad + step * i) + '" y="50" text-anchor="middle" font-size="15" fill="var(--text)">' + c + '</text>').join('');
  return '<svg lang="ja" width="' + width + '" height="58" viewBox="0 0 ' + width + ' 58" style="overflow:visible">' +
    '<polyline points="' + line + '" fill="none" stroke="currentColor" stroke-width="1.5"/>' + dots + labels + '</svg>';
}

// --- Actions ------------------------------------------------------------------

function addKanji(ch) {
  store.enrollKanji([ch]);
  toast(ch + ' added to your kanji');
  changed();
}

function removeKanji(ch) {
  if (!confirmAction('Remove ' + ch + ' from your kanji? Its progress is kept if you add it back.')) return;
  store.removeKanji(ch);
  toast(ch + ' removed');
  changed();
}

function markKnown(ch) {
  if (!confirmAction('Mark ' + ch + ' as known? It will come up only now and then.')) return;
  store.enrollKanji([ch]);
  K.TRACKS.forEach((t) => store.setReviewScore(t, ch, R.knownScore(store.reviewStats(t, ch).score)));
  toast(ch + ' marked as known');
  changed();
}
