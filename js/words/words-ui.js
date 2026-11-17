// [MODULE] words-ui | Words tab: review panel, labelled search toolbar, list grouped by progress (two columns when wide), add/edit form with rōmaji suggestions, accent preview and pasted-block fill with Undo, word sheet with progress panel, word review adapter; every reading shows its accented mora in bold
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
import { $, h, ja, jaMarked, button, confirmAction, toast, filterGroup, listGroup, part, pasteBlockField } from '../core/dom.js';
import { openKanjiCard } from '../kanji/kanji-card.js';

let query = '';

function wordScores(word) {
  return W.TRACKS.map((t) => store.reviewStats(t, word.id).score);
}

function wordStates(word) {
  return wordScores(word).map(R.stateOf);
}

/** A word's reading with its accented mora in bold (P23); plain when flat or not known. */
function readingNode(word, className, tag) {
  return jaMarked(word.reading, W.accentSplit(word.reading, word.accent), className, tag);
}

/** The headline as a node: the writing, or a kana word's reading with its accent. */
function headlineNode(word, className, tag) {
  return word.writing ? ja(word.writing, className, tag) : readingNode(word, className, tag);
}

// --- Words tab ----------------------------------------------------------

export function renderWords() {
  const words = W.sortForList(store.listWords());
  const screen = $('screen-words');
  const list = h('div', { id: 'word-list' });
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
    words.length ? h('div', { class: 'filters' }, filterGroup('Search', search, { forId: 'words-search', className: 'filter-search' })) : null,
    list);
  fillList(list, words);
  shell.showScreen('screen-words');
}

/** The matching words in progress groups, least known first (P18); newest first inside a group. */
function fillList(list, words) {
  const groups = R.groupByProgress(words.filter((w) => W.matchesQuery(w, query)), wordScores).map((g) =>
    listGroup(g.label, g.items.length, h('div', { class: 'word-grid' }, g.items.map(wordRow)),
      { className: 'word-group', dataset: { group: g.id } }));
  list.replaceChildren(...groups);
  if (words.length && !groups.length) list.append(h('p', { class: 'muted' }, 'No word matches “' + query + '”.'));
}

function wordRow(word) {
  const [s1, s2] = wordStates(word);
  return h('button', { type: 'button', class: 'word-row', dataset: { id: word.id }, onclick: () => openWordView(word.id) },
    h('div', { class: 'word-main' },
      headlineNode(word, 'word-head'),
      word.writing ? readingNode(word, 'word-reading') : null),
    h('div', { class: 'word-meaning' }, word.meaning),
    stateDots(s1, s2));
}

function wordItems() {
  return store.listWords().map((w) => ({ id: w.id, addedAt: w.createdAt }));
}

// --- Word sheet ---------------------------------------------------------

/**
 * Layout: hero (the word and its reading; the progress panel under it on a
 * phone, beside it on a wide sheet) -> meaning, notes, kanji as hairline rows
 * (two columns on a wide sheet), then the example across the full width ->
 * Edit / Delete on the right. See words.css. Re-opening replaces the sheet's
 * content in place.
 */
export function openWordView(id) {
  const word = store.getWord(id);
  if (!word) return;
  const kanji = W.extractKanji(word.writing, K.isLibraryKanji);
  const field = (key, className = 'part') => (word[key]
    ? h('div', { class: className }, h('div', { class: 'part-label' }, W.FIELD_LABELS[key]),
      h('div', { class: 'part-text pre', lang: key === 'example' ? 'ja' : null }, word[key]))
    : null);

  shell.openSheet(h('div', { class: 'word-view', id: 'word-view' },
    h('div', { class: 'sheet-head' }, h('span'), button('✕', shell.closeSheet, 'icon-btn ghost', { 'aria-label': 'Close' })),
    h('div', { class: 'word-hero' },
      h('div', { class: 'hero' }, headlineNode(word, 'hero-word'), word.writing ? readingNode(word, 'hero-reading') : null),
      progressPanel(word)),
    h('div', { class: 'word-fields' },
      field('meaning'), field('notes'),
      kanji.length ? h('div', { class: 'part' }, h('div', { class: 'part-label' }, 'Kanji'),
        h('div', { class: 'chips' }, kanji.map((ch) => button(ja(ch), () => openKanjiCard(ch), 'chip glyph-chip')))) : null,
      field('example', 'part wide')),
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
  const scores = wordScores(word);
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
 *
 * The Kanji field is a one-line textarea so that a pasted block keeps its lines
 * (an <input> drops them): the block fills the form (W.parsePaste, P20), and
 * Undo puts back what the fields held before the paste.
 *
 * Layout: Kanji, Reading, Meaning | Notes in the grid (two columns when wide),
 * then Example across the full width. The example stays a textarea: words made
 * from a sentence keep the sentence and its translation on two lines.
 *
 * The Reading field holds the accent notation (P23: "[きょ]う", "とけい [flat]");
 * a word being edited shows its accent that way, and the preview under the
 * field shows the mora that will be in bold.
 */
export function openWordForm(prefill = {}, { id = null, swap = false } = {}) {
  const back = () => renderWords();
  if (swap) shell.swapBack(back); else shell.enterBack(back);

  const inputs = {};
  const errors = {};
  const input = (key, props) => {
    const area = Boolean(props.multiline || props.oneLine);
    inputs[key] = h(area ? 'textarea' : 'input', {
      id: 'word-' + key, name: key, lang: props.lang, rows: area ? props.rows || 1 : null,
      type: area ? null : 'text', class: props.oneLine ? 'one-line' : null, placeholder: props.placeholder,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': 'word-' + key + '-error'
    });
    inputs[key].value = prefill[key] || '';
    errors[key] = h('div', { class: 'field-error', id: 'word-' + key + '-error', role: 'alert' });
    return h('label', { class: 'field' + (props.required ? ' required' : ''), for: 'word-' + key },
      h('span', { class: 'field-label' }, W.FIELD_LABELS[key], props.required ? h('em', null, ' required') : null),
      inputs[key], props.after || null, errors[key]);
  };

  const suggestions = h('div', { class: 'chips suggestions', id: 'reading-suggestions', 'aria-live': 'polite' });
  const accentPreview = h('div', { class: 'field-note', id: 'accent-preview', 'aria-live': 'polite' });
  const kanjiPreview = h('div', { class: 'field-note', id: 'kanji-preview' });
  const pasteNote = h('span', { class: 'field-note', id: 'word-paste-note', 'aria-live': 'polite' });
  const undoBtn = button('Undo', () => undoPaste(), 'small ghost', { id: 'btn-paste-undo' });
  const pasteBar = h('div', { class: 'parse-bar', hidden: true }, undoBtn, pasteNote);
  let beforePaste = null;

  const form = h('form', { class: 'word-form', id: 'word-form', autocomplete: 'off', novalidate: true },
    h('div', { class: 'form-grid' },
      h('div', { class: 'form-col' },
        input('writing', {
          oneLine: true, lang: 'ja', placeholder: 'e.g. 勉強 — leave empty for a kana-only word', after: [kanjiPreview, pasteBar]
        }),
        input('reading', { lang: 'ja', required: true, placeholder: 'kana, or type rōmaji: benkyou', after: [suggestions, accentPreview] }),
        input('meaning', { multiline: true, rows: 2, required: true, placeholder: 'study' })),
      h('div', { class: 'form-col stretch' },
        input('notes', { multiline: true, rows: 5, placeholder: 'anything that helps you remember' }))),
    input('example', { multiline: true, rows: 2, lang: 'ja', placeholder: '毎日日本語を勉強します。 - I study Japanese every day.' }),
    h('div', { class: 'actions' },
      h('button', { type: 'submit', class: 'primary', id: 'btn-save-word' }, 'Save'),
      button('Cancel', shell.leave, 'ghost', { id: 'btn-cancel-word' })));

  inputs.reading.value = W.formatAccent(prefill.reading || '', prefill.accent);

  // Rōmaji suggestions work on the reading without its [flat] mark; picking one keeps the mark.
  const updateSuggestions = () => {
    const { body, flat } = W.splitFlatMark(inputs.reading.value);
    suggestions.replaceChildren();
    if (!hasLatin(body)) return;
    const hira = toHiragana(body);
    const kata = toKatakana(body);
    if (hasLatin(hira)) {
      suggestions.append(h('span', { class: 'muted' }, 'Keep typing…'));
      return;
    }
    const tail = flat ? ' ' + W.FLAT_MARK : '';
    suggestions.append(
      button(ja(hira), () => pick(hira + tail), 'chip suggestion', { 'data-script': 'hiragana', 'aria-label': 'Use ' + hira }),
      button(ja(kata), () => pick(kata + tail), 'chip suggestion', { 'data-script': 'katakana', 'aria-label': 'Use ' + kata }));
  };
  const updateAccentPreview = () => {
    const value = inputs.reading.value;
    accentPreview.replaceChildren();
    if (!/[[［]/.test(value)) return;
    const { reading, accent } = W.splitAccent(value);
    if (accent === 0) accentPreview.append('Accent: flat, no mora in bold');
    else if (accent) accentPreview.append('Accent: ', jaMarked(reading, W.accentSplit(reading, accent), 'preview-kana'));
  };
  const updateReading = () => {
    updateSuggestions();
    updateAccentPreview();
  };
  const pick = (kana) => {
    inputs.reading.value = kana;
    updateReading();
    inputs.reading.focus();
  };
  const updateKanjiPreview = () => {
    const chars = W.extractKanji(inputs.writing.value, K.isLibraryKanji);
    const fresh = chars.filter((ch) => !store.isEnrolled(ch));
    kanjiPreview.replaceChildren();
    if (fresh.length) kanjiPreview.append('Adds to your kanji: ', ja(fresh.join(' '), 'preview-kanji'));
    else if (chars.length) kanjiPreview.append('Its kanji are already in your list.');
  };
  // Overwrites the fields the block fills; the Kanji field always (a kana word has no writing).
  const fillFromPaste = (value, previous) => {
    const parsed = W.parsePaste(value);
    if (!parsed) return false;
    beforePaste = Object.fromEntries(W.FIELDS.map((f) => [f, inputs[f].value]));
    beforePaste.writing = previous;
    W.FIELDS.filter((f) => f === 'writing' || parsed[f]).forEach((f) => { inputs[f].value = parsed[f]; });
    pasteNote.textContent = 'Filled from the pasted lines.';
    pasteBar.hidden = false;
    updateReading();
    return true;
  };
  const undoPaste = () => {
    if (!beforePaste) return;
    W.FIELDS.forEach((f) => { inputs[f].value = beforePaste[f]; });
    beforePaste = null;
    pasteBar.hidden = true;
    updateReading();
    updateKanjiPreview();
    inputs.writing.focus();
  };

  pasteBlockField(inputs.writing, inputs.reading, fillFromPaste);
  inputs.reading.addEventListener('input', updateReading);
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
  updateReading();
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
    inputs.reading.value = W.formatAccent(draft.reading, draft.accent);
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

function renderWordPart(word, key, asPrompt) {
  const value = word[key];
  if (!value) return null;
  if (asPrompt) {
    const className = 'prompt-ja' + (value.length > 6 ? ' long' : '');
    if (key === 'meaning') return h('div', { class: 'prompt-text' }, value);
    return key === 'reading' ? readingNode(word, className, 'div') : ja(value, className, 'div');
  }
  if (key === 'writing') return part(W.FIELD_LABELS.writing, ja(value, 'part-ja big', 'div'));
  if (key === 'reading') return part(W.FIELD_LABELS.reading, readingNode(word, 'part-ja', 'div'));
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
    label: (word) => headlineNode(word, 'summary-item'),
    onExit: renderWords,
    again: () => composeRun(track)
  });
}
