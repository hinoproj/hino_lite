// [MODULE] kanji-card | Kanji card sheet: glyph, readings, stroke order, radicals/components, example words with pitch accent, list actions
// [IFACE] layer: presentation | in: a kanji character, an onChange callback -> out: the card in the sheet, enrollment/known changes | crosses: [browser DOM]
// [GRAPH] needs: [kanji, library, words, review, storage, shell, dom, words-ui] | feeds: [kanji-ui, words-ui] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

/**
 * Ported from JLPT_coach's kanji card (not verbatim). The card keeps its own
 * small view stack: tapping a component opens that kanji, tapping an example
 * word opens the word view, and "←" walks back; the sheet itself has a single
 * back entry, so Android's back button closes the card.
 */

import * as K from './kanji.js';
import * as library from './library.js';
import * as W from '../words/words.js';
import * as R from '../review/review.js';
import * as store from '../core/storage.js';
import * as shell from '../core/shell.js';
import { h, ja, button, confirmAction, toast } from '../core/dom.js';
import { openWordForm, openWordView } from '../words/words-ui.js';

const WORDS_SHOWN = 8;

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

async function kanjiView(ch) {
  const entry = K.indexEntry(ch);
  if (!entry) return h('div', { class: 'kanji-card' }, head(), h('p', { class: 'muted' }, ch + ' is not in the kanji library.'));
  const [info, svg] = await Promise.all([library.detail(ch), library.strokeSvg(ch)]);
  const enrolled = store.isEnrolled(ch);
  const states = K.TRACKS.map((t) => R.stateOf(store.reviewStats(t, ch).score));
  const known = K.TRACKS.every((t) => store.reviewStats(t, ch).score >= R.LEARNED_AT);
  const levelLabel = K.LEVELS.find((l) => l.id === entry.level).label;
  const yourWords = K.wordsUsing(ch, store.listWords());
  const alt = info ? info.alt : [];

  return h('div', { class: 'kanji-card', id: 'kanji-card', dataset: { kanji: ch } },
    head(),
    h('div', { class: 'hero' },
      ja(ch, 'hero-glyph', 'div'),
      h('div', { class: 'hero-meta' }, h('span', { class: 'level-badge' }, levelLabel), ' ', entry.meaning),
      alt.length ? h('div', { class: 'muted' }, 'also: ' + alt.join(', ')) : null),

    h('div', { class: 'card-status' },
      enrolled
        ? h('div', { class: 'states' }, K.TRACKS.map((t, i) =>
          h('span', { class: 'state-chip', dataset: { state: states[i] } }, K.TRACK_INFO[t].label + ': ' + states[i])))
        : h('p', { class: 'muted' }, 'Not in your kanji list.'),
      h('div', { class: 'actions' },
        enrolled
          ? button('Remove from my kanji', () => removeKanji(ch), 'ghost', { id: 'btn-kanji-remove' })
          : button('+ Add to my kanji', () => addKanji(ch), 'primary', { id: 'btn-kanji-add' }),
        known ? null : button('Mark as known', () => markKnown(ch), 'ghost', { id: 'btn-kanji-known' }))),

    yourWords.length
      ? zone('In your words', h('div', { class: 'chips' }, yourWords.map((w) =>
        button(ja(W.headline(w)), () => openWordView(w.id), 'chip', { 'data-word-id': w.id }))))
      : null,

    info ? null : h('p', { class: 'notice' }, 'The kanji library has not finished downloading yet — open the Kanji tab to finish it.'),

    info ? h('div', { class: 'card-row' },
      svg ? zone('Stroke order', h('div', { class: 'strokes', html: svg, role: 'img', 'aria-label': 'Stroke order of ' + ch }), 'strokes-zone') : null,
      zone('Readings', readingsNode(info), 'readings-zone')) : null,

    info && (info.rad.length || info.comp.length) ? h('div', { class: 'card-row' },
      info.rad.length ? zone('Radicals', partsNode(info.rad, false)) : null,
      info.comp.length ? zone('Components', partsNode(info.comp, true)) : null) : null,

    info && info.words.length ? zone('Example words (' + info.words.length + ')', exampleWords(ch, info.words)) : null);
}

export function readingsNode(info) {
  if (!info.on.length && !info.kun.length) return h('p', { class: 'muted' }, 'No readings listed.');
  return h('div', { class: 'readings' },
    info.on.map((r) => h('div', { class: 'reading-pill on' }, h('span', { class: 'rt' }, 'On'), ja(r, 'rv'))),
    info.kun.map((r) => h('div', { class: 'reading-pill kun' }, h('span', { class: 'rt' }, 'Kun'), ja(r, 'rv'))));
}

function partsNode(parts, linkable) {
  return h('div', { class: 'rad-viz' }, parts.map(([glyph, meaning]) => {
    const open = linkable && glyph !== stack[stack.length - 1].ch && K.isLibraryKanji(glyph);
    return h('div', { class: 'rad-group' },
      h('div', { class: 'rl' }, meaning),
      open
        ? button(ja(glyph), () => push({ type: 'kanji', ch: glyph }), 'rc rc-link', { title: 'Open ' + glyph })
        : ja(glyph, 'rc', 'div'));
  }));
}

function exampleWords(ch, words) {
  const list = h('div', { class: 'example-words' });
  const fill = (count) => list.replaceChildren(...words.slice(0, count).map((word) =>
    h('button', { type: 'button', class: 'example-row', onclick: () => push({ type: 'word', ch, word }) },
      ja(word[0], 'w'), ja(word[1], 'r'), h('span', { class: 'm' }, word[2].split(';')[0]))));
  fill(WORDS_SHOWN);
  if (words.length <= WORDS_SHOWN) return list;
  const more = button('Show all ' + words.length + ' words', () => {
    fill(words.length);
    more.remove();
  }, 'ghost small', { id: 'btn-more-words' });
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
