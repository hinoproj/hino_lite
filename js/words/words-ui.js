// [MODULE] words-ui | Words tab: review panel, searchable list, add/edit form with rōmaji suggestions, word sheet with progress panel, word review adapter
// [IFACE] layer: presentation | in: DOM events, prefilled drafts (from the kanji card) -> out: rendered words screens, saved words, enrolled kanji, words marked as known | crosses: [browser DOM]
// [GRAPH] needs: [words, romaji, kanji, review, review-ui, storage, shell, dom, kanji-card] | feeds: [main, kanji-card] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

import * as W from './words.js';
import { toHiragana, toKatakana, hasLatin } from '../core/romaji.js';
import * as K from '../kanji/kanji.js';
import * as R from '../review/review.js';
import { startReview, trackPanel, stateDots, trackRow } from '../review/review-ui.js';
import * as store from '../core/storage.js';
import * as shell from '../core/shell.js';
import { $, h, ja, button, confirmAction, toast } from '../core/dom.js';
import { openKanjiCard } from '../kanji/kanji-card.js';

let query = '';

function wordStates(word) {
  return W.TRACKS.map((t) => R.stateOf(store.reviewStats(t, word.id).score));
}

// --- Words tab ----------------------------------------------------------

export function renderWords() {
  const words = W.sortForList(store.listWords());
  const screen = $('screen-words');
  const list = h('div', { class: 'word-list', id: 'word-list' });
  const search = h('input', {
    type: 'search', id: 'words-search', class: 'search', placeholder: 'Search words', value: query,
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    oninput: (e) => { query = e.target.value; fillList(list, words); }
  });

  screen.replaceChildren(
    h('div', { class: 'topbar' },
      h('h1', null, 'Words ', h('span', { class: 'sub' }, words.length + (words.length === 1 ? ' word' : ' words'))),
      button('+ Add word', () => openWordForm(), 'primary', { id: 'btn-add-word' })),
    words.length
      ? trackPanel(W.TRACKS, W.TRACK_INFO, wordItems, startWordReview)
      : h('div', { class: 'empty' },
        h('p', null, 'No words yet.'),
        h('p', { class: 'muted' }, 'Tap “+ Add word” to write down a word you want to learn. Its kanji join your kanji list by themselves.')),
    words.length ? search : null,
    list);
  fillList(list, words);
  shell.showScreen('screen-words');
}

function fillList(list, words) {
  const shown = words.filter((w) => W.matchesQuery(w, query));
  list.replaceChildren(...shown.map((word) => {
    const [s1, s2] = wordStates(word);
    return h('button', { type: 'button', class: 'word-row', dataset: { id: word.id }, onclick: () => openWordView(word.id) },
      h('div', { class: 'word-main' },
        ja(W.headline(word), 'word-head'),
        word.writing ? ja(word.reading, 'word-reading') : null),
      h('div', { class: 'word-meaning' }, word.meaning),
      stateDots(s1, s2));
  }));
  if (words.length && !shown.length) list.append(h('p', { class: 'muted' }, 'No word matches “' + query + '”.'));
}

function wordItems() {
  return store.listWords().map((w) => ({ id: w.id, addedAt: w.createdAt }));
}

// --- Word sheet ---------------------------------------------------------

/**
 * Layout: hero (the word and its reading | the progress panel) -> meaning,
 * example, notes -> kanji -> Edit / Delete. The panel drops under the word on
 * a phone (words.css). Re-opening replaces the sheet's content in place.
 */
export function openWordView(id) {
  const word = store.getWord(id);
  if (!word) return;
  const kanji = W.extractKanji(word.writing, K.isLibraryKanji);
  const field = (key) => (word[key]
    ? h('div', { class: 'part' }, h('div', { class: 'part-label' }, W.FIELD_LABELS[key]),
      h('div', { class: 'part-text pre', lang: key === 'example' ? 'ja' : null }, word[key]))
    : null);

  shell.openSheet(h('div', { class: 'word-view', id: 'word-view' },
    h('div', { class: 'sheet-head' }, h('span'), button('✕', shell.closeSheet, 'icon-btn ghost', { 'aria-label': 'Close' })),
    h('div', { class: 'word-hero' },
      h('div', { class: 'hero' }, ja(W.headline(word), 'hero-word'), word.writing ? ja(word.reading, 'hero-reading') : null),
      progressPanel(word)),
    field('meaning'), field('example'), field('notes'),
    kanji.length ? h('div', { class: 'part' }, h('div', { class: 'part-label' }, 'Kanji'),
      h('div', { class: 'chips' }, kanji.map((ch) => button(ja(ch), () => openKanjiCard(ch), 'chip glyph-chip')))) : null,
    h('div', { class: 'actions' },
      button('Edit', () => {
        shell.closeSheetNow();
        openWordForm(word, { id: word.id, swap: true });
      }, 'primary', { id: 'btn-edit-word' }),
      button('Delete', () => {
        if (!confirmAction('Delete “' + W.headline(word) + '”? Its progress goes with it. Its kanji stay in your kanji list.')) return;
        store.deleteWord(word.id);
        if (shell.activeTab() === 'words') renderWords();
        shell.closeSheet();
        toast('Word deleted');
      }, 'danger', { id: 'btn-delete-word' }))), { label: W.headline(word) });
}

/** Both review directions with their state, and "Mark as known" until both are at least learned. */
function progressPanel(word) {
  const scores = W.TRACKS.map((t) => store.reviewStats(t, word.id).score);
  return h('section', { class: 'progress-panel', 'aria-label': 'Progress' },
    W.TRACKS.map((t, i) => trackRow(W.TRACK_INFO[t].label, R.stateOf(scores[i]))),
    R.isKnown(scores) ? null : h('div', { class: 'actions' },
      button('Mark as known', () => markWordKnown(word), 'ghost small', { id: 'btn-word-known' })));
}

function markWordKnown(word) {
  if (!confirmAction('Mark “' + W.headline(word) + '” as known? It will come up only now and then.')) return;
  W.TRACKS.forEach((t) => store.setReviewScore(t, word.id, R.knownScore(store.reviewStats(t, word.id).score)));
  if (shell.activeTab() === 'words') renderWords();
  openWordView(word.id);
  toast(W.headline(word) + ' marked as known');
}

// --- Add / edit form -----------------------------------------------------

/**
 * `prefill` fills the fields (a word to edit, or an example word from a kanji
 * card). `id` edits that word. `swap` reuses the current back entry -- used
 * when the form replaces an open sheet rather than opening from a tab.
 */
export function openWordForm(prefill = {}, { id = null, swap = false } = {}) {
  const back = () => renderWords();
  if (swap) shell.swapBack(back); else shell.enterBack(back);

  const inputs = {};
  const errors = {};
  const input = (key, props) => {
    inputs[key] = h(props.multiline ? 'textarea' : 'input', {
      id: 'word-' + key, name: key, lang: props.lang, rows: props.multiline ? props.rows : null,
      type: props.multiline ? null : 'text', placeholder: props.placeholder,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': 'word-' + key + '-error'
    });
    inputs[key].value = prefill[key] || '';
    errors[key] = h('div', { class: 'field-error', id: 'word-' + key + '-error', role: 'alert' });
    return h('label', { class: 'field' + (props.required ? ' required' : ''), for: 'word-' + key },
      h('span', { class: 'field-label' }, W.FIELD_LABELS[key], props.required ? h('em', null, ' required') : null),
      inputs[key], props.after || null, errors[key]);
  };

  const suggestions = h('div', { class: 'chips suggestions', id: 'reading-suggestions', 'aria-live': 'polite' });
  const kanjiPreview = h('div', { class: 'field-note', id: 'kanji-preview' });

  const form = h('form', { class: 'word-form', id: 'word-form', autocomplete: 'off', novalidate: true },
    h('div', { class: 'form-grid' },
      h('div', { class: 'form-col' },
        input('writing', { lang: 'ja', placeholder: 'e.g. 勉強 — leave empty for a kana-only word', after: kanjiPreview }),
        input('reading', { lang: 'ja', required: true, placeholder: 'kana, or type rōmaji: benkyou', after: suggestions }),
        input('meaning', { multiline: true, rows: 2, required: true, placeholder: 'study' })),
      h('div', { class: 'form-col' },
        input('example', { multiline: true, rows: 3, lang: 'ja', placeholder: '毎日日本語を勉強します。' }),
        input('notes', { multiline: true, rows: 3, placeholder: 'anything that helps you remember' }))),
    h('div', { class: 'actions' },
      h('button', { type: 'submit', class: 'primary', id: 'btn-save-word' }, 'Save'),
      button('Cancel', shell.leave, 'ghost', { id: 'btn-cancel-word' })));

  const updateSuggestions = () => {
    const value = inputs.reading.value;
    suggestions.replaceChildren();
    if (!hasLatin(value)) return;
    const hira = toHiragana(value);
    const kata = toKatakana(value);
    if (hasLatin(hira)) {
      suggestions.append(h('span', { class: 'muted' }, 'Keep typing…'));
      return;
    }
    suggestions.append(
      button(ja(hira), () => pick(hira), 'chip suggestion', { 'data-script': 'hiragana', 'aria-label': 'Use ' + hira }),
      button(ja(kata), () => pick(kata), 'chip suggestion', { 'data-script': 'katakana', 'aria-label': 'Use ' + kata }));
  };
  const pick = (kana) => {
    inputs.reading.value = kana;
    updateSuggestions();
    inputs.reading.focus();
  };
  const updateKanjiPreview = () => {
    const chars = W.extractKanji(inputs.writing.value, K.isLibraryKanji);
    const fresh = chars.filter((ch) => !store.isEnrolled(ch));
    kanjiPreview.replaceChildren();
    if (fresh.length) kanjiPreview.append('Adds to your kanji: ', ja(fresh.join(' '), 'preview-kanji'));
    else if (chars.length) kanjiPreview.append('Its kanji are already in your list.');
  };

  inputs.reading.addEventListener('input', updateSuggestions);
  inputs.writing.addEventListener('input', updateKanjiPreview);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveFromForm(inputs, errors, id);
  });

  $('screen-word-form').replaceChildren(
    h('div', { class: 'topbar' },
      button('← Back', shell.leave, 'icon-btn ghost', { id: 'btn-word-form-back' }),
      h('h1', null, id ? 'Edit word' : 'New word')),
    form);
  updateSuggestions();
  updateKanjiPreview();
  shell.showScreen('screen-word-form');
  if (!id && !prefill.writing) inputs.writing.focus();
}

function saveFromForm(inputs, errors, id) {
  const draft = W.normalizeDraft(Object.fromEntries(W.FIELDS.map((f) => [f, inputs[f].value])));
  const problems = W.validate(draft);
  const dup = store.listWords().find((w) => w.id !== id && W.duplicateKey(w) === W.duplicateKey(draft));

  W.FIELDS.forEach((f) => errors[f].replaceChildren());
  Object.entries(problems).forEach(([f, message]) => errors[f].append(message));
  if (dup && !problems.reading) {
    errors.reading.append('You already have this word. ',
      button('Open it', () => { shell.swapBack(() => renderWords()); renderWords(); openWordView(dup.id); }, 'link-btn'));
  }
  if (Object.keys(problems).length || dup) {
    inputs.reading.value = draft.reading;
    const first = W.FIELDS.find((f) => errors[f].childNodes.length);
    if (first) inputs[first].focus();
    return;
  }

  store.saveWord(draft, id);
  const added = store.enrollKanji(W.extractKanji(draft.writing, K.isLibraryKanji));
  toast(added.length ? 'Saved · ' + added.join(' ') + ' added to your kanji' : 'Saved');
  shell.leave();
}

// --- Word review --------------------------------------------------------

function composeRun(track) {
  return R.buildRun(wordItems(), (id) => store.reviewStats(track, id), store.getSettings().runSize)
    .map((item) => store.getWord(item.id))
    .filter(Boolean);
}

function part(label, content) {
  return h('div', { class: 'part' }, h('div', { class: 'part-label' }, label), content);
}

function renderWordPart(word, key, asPrompt) {
  const value = word[key];
  if (!value) return null;
  if (asPrompt) {
    return key === 'meaning'
      ? h('div', { class: 'prompt-text' }, value)
      : ja(value, 'prompt-ja' + (value.length > 6 ? ' long' : ''), 'div');
  }
  if (key === 'writing') return part(W.FIELD_LABELS.writing, ja(value, 'part-ja big', 'div'));
  if (key === 'reading') return part(W.FIELD_LABELS.reading, ja(value, 'part-ja', 'div'));
  if (key === 'meaning') return part(W.FIELD_LABELS.meaning, h('div', { class: 'part-text pre' }, value));
  return part(W.FIELD_LABELS[key], h('div', { class: 'part-text pre', lang: key === 'example' ? 'ja' : null }, value));
}

function startWordReview(track) {
  const items = composeRun(track);
  if (!items.length) return;
  startReview({
    title: 'Words',
    modeLabel: W.TRACK_INFO[track].label,
    track,
    items,
    plan: (word) => W.cardPlan(word, track),
    renderPart: renderWordPart,
    label: (word) => ja(W.headline(word), 'summary-item'),
    onExit: renderWords,
    again: () => composeRun(track)
  });
}
