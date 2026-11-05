// [MODULE] sentences-ui | Sentences tab: review panel, labelled search toolbar, list grouped by progress, add/edit form with Parse and pasted-block fill (one Undo), sentence sheet with progress panel, word-card prompt after a new sentence, sentence review adapter
// [IFACE] layer: presentation | in: DOM events -> out: rendered sentence screens, saved sentences, saved words, enrolled kanji, started sentence reviews, sentences marked as known | crosses: [browser DOM]
// [GRAPH] needs: [sentences, words, kanji, romaji, review, review-ui, storage, shell, dom] | feeds: [main, kanji-card] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

import * as S from './sentences.js';
import * as W from '../words/words.js';
import * as K from '../kanji/kanji.js';
import { toHiragana, hasLatin } from '../core/romaji.js';
import * as R from '../review/review.js';
import { startReview, trackPanel, stateDots, trackRow } from '../review/review-ui.js';
import * as store from '../core/storage.js';
import * as shell from '../core/shell.js';
import { $, h, ja, button, confirmAction, toast, filterGroup, listGroup, part, pasteBlockField } from '../core/dom.js';

let query = '';

function sentenceScores(sentence) {
  return S.TRACKS.map((t) => store.reviewStats(t, sentence.id).score);
}

// --- Sentences tab --------------------------------------------------------

export function renderSentences() {
  const sentences = S.sortForList(store.listSentences());
  const screen = $('screen-sentences');
  const list = h('div', { id: 'sentence-list' });
  const search = h('input', {
    type: 'search', id: 'sentences-search', class: 'search', placeholder: 'Search sentences', value: query,
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    oninput: (e) => { query = e.target.value; fillList(list, sentences); }
  });

  screen.replaceChildren(
    h('div', { class: 'topbar' },
      h('h1', null, 'Sentences ', h('span', { class: 'sub' }, sentences.length + (sentences.length === 1 ? ' sentence' : ' sentences'))),
      button('+ Add sentence', () => openSentenceForm(), 'primary', { id: 'btn-add-sentence' })),
    !sentences.length
      ? h('div', { class: 'empty' },
        h('p', null, 'No sentences yet.'),
        h('p', { class: 'muted' }, 'Tap “+ Add sentence” to write or paste one. Its kanji words can become word cards right away; readings in brackets, like ',
          ja('聞いて（きいて）'), ', are filled in for you.'))
      : sentences.some(S.isReviewable)
        ? trackPanel(S.TRACKS, S.TRACK_INFO, sentenceItems, startSentenceReview)
        : h('p', { class: 'muted', id: 'sentences-no-review' }, 'Sentences with a translation can be reviewed — add one to start.'),
    sentences.length
      ? h('div', { class: 'filters' }, filterGroup('Search', search, { forId: 'sentences-search', className: 'filter-search' }))
      : null,
    list);
  fillList(list, sentences);
  shell.showScreen('screen-sentences');
}

/** The matching sentences in progress groups, least known first (P19); one column, newest first inside a group. */
function fillList(list, sentences) {
  const groups = R.groupByProgress(sentences.filter((s) => S.matchesQuery(s, query)), sentenceScores).map((g) =>
    listGroup(g.label, g.items.length, h('div', { class: 'sentence-list' }, g.items.map(sentenceRow)),
      { className: 'sentence-group', dataset: { group: g.id } }));
  list.replaceChildren(...groups);
  if (sentences.length && !groups.length) list.append(h('p', { class: 'muted' }, 'No sentence matches “' + query + '”.'));
}

function sentenceRow(s) {
  const reviewable = S.isReviewable(s);
  return h('button', { type: 'button', class: 'sentence-row', dataset: { id: s.id }, onclick: () => openSentenceView(s.id) },
    h('div', { class: 'sentence-main' },
      ja(s.sentence, 'sentence-text', 'div'),
      reviewable
        ? h('div', { class: 'sentence-translation' }, s.translation)
        : h('div', { class: 'sentence-translation no-translation' }, 'No translation — not in reviews')),
    reviewable ? stateDots(...sentenceScores(s).map(R.stateOf)) : null);
}

function sentenceItems() {
  return store.listSentences().filter(S.isReviewable).map((s) => ({ id: s.id, addedAt: s.createdAt }));
}

// --- Sentence sheet -------------------------------------------------------

/**
 * The sentence sheet; also opened from a kanji card's "In your sentences". Laid out as the word
 * sheet: the progress panel under the sentence on a phone, beside it on a wide sheet
 * (sentences.css). Re-opening replaces the sheet's content in place.
 */
export function openSentenceView(id) {
  const sentence = store.getSentence(id);
  if (!sentence) return;
  const field = (key) => (sentence[key]
    ? h('div', { class: 'part' }, h('div', { class: 'part-label' }, S.FIELD_LABELS[key]),
      h('div', { class: 'part-text pre' }, sentence[key]))
    : null);

  shell.openSheet(h('div', { class: 'sentence-view', id: 'sentence-view' },
    h('div', { class: 'sheet-head' }, h('span'), button('✕', shell.closeSheet, 'icon-btn ghost', { 'aria-label': 'Close' })),
    h('div', { class: 'sentence-head' },
      h('div', { class: 'sentence-hero' },
        ja(sentence.sentence, 'sentence-big pre', 'div'),
        sentence.reading ? ja(sentence.reading, 'sentence-reading pre', 'div') : null),
      progressPanel(sentence)),
    field('translation'), field('notes'),
    h('div', { class: 'actions' },
      button('Edit', () => {
        shell.closeSheetNow();
        openSentenceForm(sentence, { id: sentence.id, swap: true });
      }, 'primary', { id: 'btn-edit-sentence' }),
      button('Delete', () => {
        if (!confirmAction('Delete this sentence? Its progress goes with it. Word cards made from it stay.')) return;
        store.deleteSentence(sentence.id);
        if (shell.activeTab() === 'sentences') renderSentences();
        shell.closeSheet();
        toast('Sentence deleted');
      }, 'danger', { id: 'btn-delete-sentence' }))), { label: sentence.sentence });
}

/** Both review directions with their state and "Mark as known" -- or why the sentence is not reviewed. */
function progressPanel(sentence) {
  if (!S.isReviewable(sentence)) {
    return h('section', { class: 'progress-panel', 'aria-label': 'Progress' },
      h('p', { class: 'muted', id: 'sentence-no-review' }, 'Add a translation to review this sentence.'));
  }
  const scores = sentenceScores(sentence);
  return h('section', { class: 'progress-panel', 'aria-label': 'Progress' },
    S.TRACKS.map((t, i) => trackRow(S.TRACK_INFO[t].label, R.stateOf(scores[i]))),
    R.isKnown(scores) ? null : h('div', { class: 'actions' },
      button('Mark as known', () => markSentenceKnown(sentence), 'ghost small', { id: 'btn-sentence-known' })));
}

function markSentenceKnown(sentence) {
  if (!confirmAction('Mark this sentence as known? It will come up only now and then.')) return;
  S.TRACKS.forEach((t) => store.setReviewScore(t, sentence.id, R.knownScore(store.reviewStats(t, sentence.id).score)));
  if (shell.activeTab() === 'sentences') renderSentences();
  openSentenceView(sentence.id);
  toast('Sentence marked as known');
}

// --- Add / edit form -------------------------------------------------------

/**
 * Parse shows while it would change something (S.canParse). It overwrites the
 * sentence, and the reading and translation when it found them; Undo puts
 * back what was there. The words it found are remembered for the prompt that
 * follows saving a new sentence, even if the learner edits the text after.
 *
 * A pasted block (several lines, P20) fills the form at once (S.parsePaste);
 * the same Undo then puts back what the fields held before the paste.
 */
function openSentenceForm(prefill = {}, { id = null, swap = false } = {}) {
  const back = () => renderSentences();
  if (swap) shell.swapBack(back); else shell.enterBack(back);

  const inputs = {};
  const errors = {};
  const input = (key, props) => {
    inputs[key] = h('textarea', {
      id: 'sentence-' + key, name: key, lang: props.lang, rows: props.rows, placeholder: props.placeholder,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': 'sentence-' + key + '-error'
    });
    inputs[key].value = prefill[key] || '';
    errors[key] = h('div', { class: 'field-error', id: 'sentence-' + key + '-error', role: 'alert' });
    return h('label', { class: 'field' + (props.required ? ' required' : ''), for: 'sentence-' + key },
      h('span', { class: 'field-label' }, S.FIELD_LABELS[key], props.required ? h('em', null, ' required') : null),
      inputs[key], props.after || null, errors[key]);
  };

  let known = [];
  let before = null;
  const parseNote = h('span', { class: 'field-note', id: 'parse-note', 'aria-live': 'polite' });
  const parseBtn = button('Parse', () => doParse(), 'small', { id: 'btn-parse', hidden: true });
  const undoBtn = button('Undo', () => undoParse(), 'small ghost', { id: 'btn-parse-undo', hidden: true });
  const readingPreview = h('div', { class: 'field-note', id: 'sentence-reading-preview' });

  const form = h('form', { class: 'sentence-form', id: 'sentence-form', autocomplete: 'off', novalidate: true },
    h('div', { class: 'form-grid' },
      h('div', { class: 'form-col' },
        input('sentence', {
          lang: 'ja', rows: 3, required: true, placeholder: 'もう一度（いちど）聞いて（きいて）ください。 — Please listen once more.',
          after: h('div', { class: 'parse-bar' }, parseBtn, undoBtn, parseNote)
        }),
        input('reading', { lang: 'ja', rows: 2, placeholder: 'kana, or type rōmaji — optional', after: readingPreview })),
      h('div', { class: 'form-col' },
        input('translation', { rows: 2, placeholder: 'Please listen once more.' }),
        input('notes', { rows: 2, placeholder: 'anything that helps you remember' }))),
    h('div', { class: 'actions' },
      h('button', { type: 'submit', class: 'primary', id: 'btn-save-sentence' }, 'Save'),
      button('Cancel', shell.leave, 'ghost', { id: 'btn-cancel-sentence' })));

  const refresh = () => {
    parseBtn.hidden = !S.canParse(inputs.sentence.value);
    const typed = inputs.reading.value;
    readingPreview.replaceChildren();
    if (hasLatin(typed)) readingPreview.append('Saves as ', ja(toHiragana(typed), 'preview-kana'));
  };
  const noteWords = (lead, words) => {
    parseNote.replaceChildren(lead);
    if (words.length) parseNote.append('Readings found: ', ja(words.map((w) => w.writing).join(' · ')));
  };
  const doParse = () => {
    const parsed = S.parse(inputs.sentence.value);
    before = { sentence: inputs.sentence.value, reading: inputs.reading.value, translation: inputs.translation.value };
    inputs.sentence.value = parsed.sentence;
    if (parsed.reading) inputs.reading.value = parsed.reading;
    if (parsed.translation) inputs.translation.value = parsed.translation;
    known = known.concat(parsed.words);
    noteWords('', parsed.words);
    undoBtn.hidden = false;
    refresh();
  };
  // Overwrites the fields the block fills; refresh runs next, from the field's own input listener.
  const fillFromPaste = (value, previous) => {
    const parsed = S.parsePaste(value);
    if (!parsed) return false;
    before = Object.fromEntries(S.FIELDS.map((f) => [f, inputs[f].value]));
    before.sentence = previous;
    S.FIELDS.filter((f) => f === 'sentence' || parsed[f]).forEach((f) => { inputs[f].value = parsed[f]; });
    known = known.concat(parsed.words);
    noteWords('Filled from the pasted lines. ', parsed.words);
    undoBtn.hidden = false;
    return true;
  };
  const undoParse = () => {
    if (!before) return;
    Object.entries(before).forEach(([key, value]) => { inputs[key].value = value; });
    before = null;
    undoBtn.hidden = true;
    parseNote.replaceChildren();
    refresh();
  };

  pasteBlockField(inputs.sentence, inputs.reading, fillFromPaste);
  inputs.sentence.addEventListener('input', refresh);
  inputs.reading.addEventListener('input', refresh);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveFromForm(inputs, errors, id, known);
  });

  $('screen-sentence-form').replaceChildren(
    h('div', { class: 'topbar' },
      button('← Back', shell.leave, 'icon-btn ghost', { id: 'btn-sentence-form-back' }),
      h('h1', null, id ? 'Edit sentence' : 'New sentence')),
    form);
  refresh();
  shell.showScreen('screen-sentence-form');
  if (!id) inputs.sentence.focus();
}

function saveFromForm(inputs, errors, id, known) {
  const draft = S.normalizeDraft(Object.fromEntries(S.FIELDS.map((f) => [f, inputs[f].value])));
  const problems = S.validate(draft);
  S.FIELDS.forEach((f) => errors[f].replaceChildren());
  Object.entries(problems).forEach(([f, message]) => errors[f].append(message));
  if (Object.keys(problems).length) {
    inputs.reading.value = draft.reading;
    inputs[S.FIELDS.find((f) => problems[f])].focus();
    return;
  }

  const saved = store.saveSentence(draft, id);
  const rows = id ? [] : S.candidates(saved.sentence, known);
  toast('Saved');
  if (rows.length) openWordPrompt(saved, rows);
  else shell.leave();
}

// --- Word cards from a new sentence ------------------------------------------

/** Replaces the form (same back entry): Done and the back button return to the list. */
function openWordPrompt(sentence, rows) {
  shell.swapBack(() => renderSentences());
  const example = S.exampleFor(sentence);
  $('screen-sentence-words').replaceChildren(
    h('div', { class: 'topbar' },
      button('← Done', shell.leave, 'icon-btn ghost', { id: 'btn-prompt-back' }),
      h('h1', null, 'Word cards')),
    h('div', { class: 'prompt-sentence' },
      ja(sentence.sentence, 'prompt-sentence-ja', 'div'),
      sentence.translation ? h('div', { class: 'muted' }, sentence.translation) : null),
    h('p', { class: 'muted prompt-intro' },
      'Add the words you want to learn; each card gets this sentence as its example. For a conjugated word, put its dictionary form in the meaning too: “listen — て-form of ',
      ja('聞く'), '”.'),
    h('div', { class: 'prompt-rows', id: 'prompt-rows' }, rows.map((row) => promptRow(row, example))),
    h('div', { class: 'actions' }, button('Done', shell.leave, 'primary', { id: 'btn-prompt-done' })));
  shell.showScreen('screen-sentence-words');
}

/**
 * One candidate word. Add stays disabled until the meaning and the reading are
 * filled in (a word needs both); a word already in the list is only marked.
 */
function promptRow(candidate, example) {
  const field = (cls, value, label, lang) => {
    const el = h('input', {
      type: 'text', class: cls, lang, placeholder: label, 'aria-label': label,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false'
    });
    el.value = value;
    return el;
  };
  const writing = field('pw-writing', candidate.writing, 'kanji', 'ja');
  const reading = field('pw-reading', candidate.reading, 'reading', 'ja');
  const meaning = field('pw-meaning', '', 'meaning', null);
  const status = h('div', { class: 'pw-status', role: 'status' });
  const add = button('Add', () => addWord(), 'primary small pw-add', { disabled: true });
  const row = h('div', { class: 'prompt-row', dataset: { status: 'new', writing: candidate.writing } },
    writing, reading, meaning, h('div', { class: 'pw-foot' }, status, add));

  const draft = () => W.normalizeDraft({
    writing: writing.value, reading: reading.value, meaning: meaning.value, example, notes: ''
  });
  const isDuplicate = (d) => Boolean(d.reading) && store.listWords().some((w) => W.duplicateKey(w) === W.duplicateKey(d));

  const refresh = () => {
    if (row.dataset.status === 'added') return;
    const dup = isDuplicate(draft());
    row.dataset.status = dup ? 'dup' : 'new';
    add.hidden = dup;
    add.disabled = !(meaning.value.trim() && reading.value.trim());
    status.replaceChildren();
    if (dup) status.append('Already in your list');
    else if (hasLatin(reading.value)) status.append('Reading: ', ja(toHiragana(reading.value)));
  };

  const addWord = () => {
    const d = draft();
    const problems = W.validate(d);
    if (Object.keys(problems).length) {
      status.replaceChildren(h('span', { class: 'field-error' }, Object.values(problems)[0]));
      return;
    }
    if (isDuplicate(d)) {
      refresh();
      return;
    }
    store.saveWord(d);
    const added = store.enrollKanji(W.extractKanji(d.writing, K.isLibraryKanji));
    row.dataset.status = 'added';
    reading.value = d.reading;
    [writing, reading, meaning].forEach((el) => { el.disabled = true; });
    add.hidden = true;
    status.replaceChildren('Added ✓');
    toast(added.length ? 'Added · ' + added.join(' ') + ' added to your kanji' : 'Added');
  };

  [writing, reading, meaning].forEach((el) => {
    el.addEventListener('input', refresh);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !add.disabled && !add.hidden) addWord();
    });
  });
  refresh();
  return row;
}

// --- Sentence review ------------------------------------------------------------

function composeRun(track) {
  return R.buildRun(sentenceItems(), (id) => store.reviewStats(track, id), store.getSettings().runSize)
    .map((item) => store.getSentence(item.id))
    .filter(Boolean);
}

function renderSentencePart(sentence, key, asPrompt) {
  const value = sentence[key];
  if (!value) return null;
  if (key === 'sentence') {
    const text = ja(value, 'review-sentence pre', 'div');
    return asPrompt ? text : part(S.FIELD_LABELS.sentence, text);
  }
  if (key === 'translation' && asPrompt) return h('div', { class: 'prompt-text pre' }, value);
  if (key === 'reading') return part(S.FIELD_LABELS.reading, ja(value, 'part-text pre', 'div'));
  return part(S.FIELD_LABELS[key], h('div', { class: 'part-text pre' }, value));
}

function startSentenceReview(track) {
  const items = composeRun(track);
  if (!items.length) return;
  startReview({
    title: 'Sentences',
    modeLabel: S.TRACK_INFO[track].label,
    track,
    items,
    plan: (sentence) => S.cardPlan(sentence, track),
    renderPart: renderSentencePart,
    label: (sentence) => ja(sentence.sentence, 'summary-item summary-sentence'),
    onExit: renderSentences,
    again: () => composeRun(track)
  });
}
