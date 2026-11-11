// [MODULE] kanji-ui | Kanji tab: one-time library download, review panel, labelled library toolbar (Show / JLPT level / Search) in one row, level sections of tiles, kanji review adapter (glyph beside its stroke order; readings, components, the learner's words and sentences as plain rows)
// [IFACE] layer: presentation | in: DOM events, library readiness -> out: rendered kanji screen, started kanji reviews | crosses: [browser DOM]
// [GRAPH] needs: [kanji, library, review, review-ui, storage, shell, dom, kanji-card] | feeds: [main] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

import * as K from './kanji.js';
import * as library from './library.js';
import * as R from '../review/review.js';
import { startReview, trackPanel, stateDots } from '../review/review-ui.js';
import * as store from '../core/storage.js';
import * as shell from '../core/shell.js';
import { $, h, ja, button, segmented, toast, filterGroup, listGroup, part } from '../core/dom.js';
import { openKanjiCard, readingsNode, partsList, markKanji } from './kanji-card.js';

const REVIEW_WORDS = 4;       // the learner's words and sentences on a review card: it must fit a phone
const REVIEW_SENTENCES = 2;

const view = { scope: null, levels: new Set(K.LEVELS.map((l) => l.id)), query: '' };
const dl = { ready: new Set(), running: false, progress: 0, error: '', autoTried: false };
const loaded = { info: new Map(), svg: new Map() };   // details preloaded for review runs

/** The learner's kanji list, minus anything a hand-edited backup put there that the library lacks. */
function myKanji() {
  return store.listKanji().filter((k) => K.isLibraryKanji(k.id));
}

function onScreen() {
  return !$('screen-kanji').hidden;
}

// --- Tab ------------------------------------------------------------------

/** Render the Kanji tab; `openCh` opens that kanji's card on top (deep link #kanji/<ch>). */
export function renderKanji(openCh) {
  if (view.scope === null) view.scope = myKanji().length ? 'mine' : 'all';
  buildScreen();
  shell.showScreen('screen-kanji');
  refreshLibrary();
  if (openCh && K.isLibraryKanji(openCh)) openKanjiCard(openCh, { onChanged: buildScreen });
}

function enrolledLevelsReady() {
  return myKanji().every((k) => dl.ready.has(K.indexEntry(k.id).level));
}

function buildScreen() {
  const mineCount = myKanji().length;
  const sections = h('div', { id: 'kanji-sections' });
  const search = h('input', {
    type: 'search', id: 'kanji-search', class: 'search', value: view.query,
    placeholder: 'Search: 学, がく, gaku, study', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    oninput: (e) => { view.query = e.target.value; fillSections(sections); }
  });

  $('screen-kanji').replaceChildren(
    h('div', { class: 'topbar' },
      h('h1', null, 'Kanji ', h('span', { class: 'sub' }, mineCount + ' in your list'))),
    h('div', { id: 'library-status' }),
    mineCount
      ? trackPanel(K.TRACKS, K.TRACK_INFO, () => myKanji(), startKanjiReview, { disabled: !enrolledLevelsReady() })
      : null,
    // Library toolbar: three labelled controls in one row (wrapping on a phone)
    h('div', { class: 'filters' },
      filterGroup('Show',
        segmented([{ value: 'mine', label: 'Mine (' + mineCount + ')' }, { value: 'all', label: 'All' }], view.scope, (scope) => {
          view.scope = scope;
          buildScreen();
        }, 'Show')),
      filterGroup('JLPT level',
        h('div', { class: 'segmented level-chips', role: 'group', 'aria-label': 'JLPT level' }, K.LEVELS.map((level) =>
          h('button', {
            type: 'button', class: 'level-chip', 'aria-pressed': String(view.levels.has(level.id)),
            dataset: { level: level.id },
            onclick: () => {
              if (view.levels.has(level.id)) view.levels.delete(level.id); else view.levels.add(level.id);
              if (!view.levels.size) K.LEVELS.forEach((l) => view.levels.add(l.id));   // never an empty grid
              buildScreen();
            }
          }, level.label)))),
      filterGroup('Search', search, { forId: 'kanji-search', className: 'filter-search' })),
    sections);
  renderStatus();
  fillSections(sections);
}

function fillSections(container) {
  const pool = view.scope === 'mine' ? myKanji().map((k) => k.id) : K.allKanji();
  const shown = pool.filter((ch) => K.matchesQuery(ch, view.query)).sort(K.compareKanji);
  const byLevel = new Map(K.LEVELS.map((l) => [l.id, []]));
  shown.forEach((ch) => byLevel.get(K.indexEntry(ch).level).push(ch));

  const nodes = K.LEVELS
    .filter((level) => view.levels.has(level.id) && byLevel.get(level.id).length)
    .map((level) => listGroup(level.label, byLevel.get(level.id).length,
      h('div', { class: 'kanji-grid' }, byLevel.get(level.id).map(tile)),
      { className: 'kanji-section', dataset: { level: level.id } }));

  if (!nodes.length) {
    nodes.push(view.scope === 'mine' && !myKanji().length
      ? h('div', { class: 'empty' },
        h('p', null, 'Your kanji list is empty.'),
        h('p', { class: 'muted' }, 'Kanji from your words and sentences appear here by themselves. You can also open “All” and add any kanji.'))
      : h('p', { class: 'muted' }, 'No kanji match.'));
  }
  container.replaceChildren(...nodes);
}

function tile(ch) {
  const entry = K.indexEntry(ch);
  const enrolled = store.isEnrolled(ch);
  const [s1, s2] = K.TRACKS.map((t) => R.stateOf(store.reviewStats(t, ch).score));
  return h('button', {
    type: 'button', class: 'kanji-tile' + (enrolled ? ' mine' : ''), dataset: { kanji: ch },
    onclick: () => openKanjiCard(ch, { onChanged: buildScreen })
  },
  ja(ch, 'tile-glyph'),
  h('span', { class: 'tile-meaning' }, entry.meaning),
  enrolled ? stateDots(s1, s2) : null);
}

// --- Library download --------------------------------------------------------

async function refreshLibrary() {
  if (!library.supported()) {
    dl.error = 'The kanji library needs the installed app (it cannot be stored on this page).';
    renderStatus();
    return;
  }
  const before = dl.ready.size;
  dl.ready = await library.readyLevels();
  if (onScreen() && dl.ready.size !== before) buildScreen();
  // First open of the tab in this session starts the download by itself; after a failure, the button does.
  if (dl.ready.size < K.LEVELS.length && !library.isDownloading() && !dl.autoTried) {
    dl.autoTried = true;
    startDownload();
  }
}

function startDownload() {
  dl.running = true;
  dl.error = '';
  renderStatus();
  library.download((p) => {
    dl.progress = p.bytesDone / p.bytesTotal;
    dl.ready.add(p.levelId);
    renderStatus();
  }).then((ready) => {
    dl.ready = ready;
    dl.running = false;
    if (onScreen()) buildScreen();
  }).catch((err) => {
    dl.running = false;
    dl.error = navigator.onLine === false
      ? 'You are offline. Connect to the internet once to download the kanji library.'
      : 'The download stopped (' + err.message + ').';
    renderStatus();
  });
}

function renderStatus() {
  const box = $('library-status');
  if (!box) return;
  const allReady = dl.ready.size === K.LEVELS.length;
  if (allReady && !dl.error) {
    box.replaceChildren();
    return;
  }
  const mb = (library.TOTAL_BYTES / 1e6).toFixed(1);
  box.replaceChildren(h('div', { class: 'panel library-panel' },
    h('h2', null, 'Kanji library'),
    dl.running
      ? h('div', null,
        h('p', null, 'Downloading — this happens only once (' + mb + ' MB on the device)…'),
        h('div', { class: 'run-progress' }, h('span', { id: 'library-progress', style: 'width:' + Math.round(dl.progress * 100) + '%' })),
        h('p', { class: 'muted' }, 'Ready: ' + (K.LEVELS.filter((l) => dl.ready.has(l.id)).map((l) => l.label).join(', ') || 'nothing yet')))
      : dl.error || dl.autoTried
        ? h('div', null,
          h('p', { class: dl.error ? 'notice' : 'muted' }, dl.error || 'The library is not on this device yet.'),
          library.supported() ? button('Download', startDownload, 'primary', { id: 'btn-library-download' }) : null)
        : h('p', { class: 'muted' }, 'Checking the kanji library…')));
}

// --- Kanji review ------------------------------------------------------------

async function preload(chars) {
  const missing = chars.filter((ch) => !loaded.info.has(ch));
  await Promise.all(missing.map(async (ch) => {
    const [info, svg] = await Promise.all([library.detail(ch), library.strokeSvg(ch)]);
    if (info) loaded.info.set(ch, info);
    if (svg) loaded.svg.set(ch, svg);
  }));
  return chars.filter((ch) => loaded.info.has(ch)).map((ch) => ({ id: ch }));
}

async function composeRun(track) {
  const run = R.buildRun(myKanji(), (id) => store.reviewStats(track, id), store.getSettings().runSize);
  return preload(run.map((item) => item.id));
}

/**
 * One part of a kanji review card. `strokesWithGlyph`: the plan reveals stroke order in the glyph's
 * step, so both are drawn side by side without labels; otherwise stroke order is a labelled part.
 * The learner's words and sentences are plain rows (the card is one tap target), each carrying its
 * reading and meaning or translation, since nothing on it opens.
 */
function renderKanjiPart(item, key, asPrompt, strokesWithGlyph) {
  const ch = item.id;
  const info = loaded.info.get(ch);
  if (key === 'glyph') return ja(ch, asPrompt ? 'prompt-glyph' : 'reveal-glyph', 'div');
  if (key === 'meaning') {
    const alt = info.alt.slice(0, 3).join(', ');
    return asPrompt
      ? h('div', { class: 'prompt-text' }, info.m, alt ? h('div', { class: 'prompt-alt' }, alt) : null)
      : part('Meaning', h('div', { class: 'part-text' }, info.m), alt ? h('div', { class: 'muted' }, 'also: ' + alt) : null);
  }
  if (key === 'readings') return part('Readings', readingsNode(info));
  if (key === 'strokes') {
    const svg = loaded.svg.get(ch);
    if (!svg) return null;
    const diagram = h('div', { class: 'strokes', html: svg, role: 'img', 'aria-label': 'Stroke order of ' + ch });
    return strokesWithGlyph ? h('div', { class: 'reveal-strokes' }, diagram) : part('Stroke order', h('div', { class: 'reveal-strokes' }, diagram));
  }
  if (key === 'components') return info.comp.length ? part('Components', partsList(info.comp)) : null;
  if (key === 'words') {
    const words = K.wordsUsing(ch, store.listWords()).slice(0, REVIEW_WORDS);
    return words.length ? part('Your words', h('div', { class: 'use-rows' }, words.map((w) =>
      h('div', { class: 'use-row', dataset: { wordId: w.id } },
        h('div', { class: 'use-ja', lang: 'ja' }, markKanji(w.writing, ch), w.reading ? ja(w.reading, 'use-reading') : null),
        w.meaning ? h('div', { class: 'use-meaning clamp' }, w.meaning) : null)))) : null;
  }
  if (key === 'sentences') {
    const sentences = K.sentencesUsing(ch, store.listSentences()).slice(0, REVIEW_SENTENCES);
    return sentences.length ? part('Your sentences', h('div', { class: 'use-rows' }, sentences.map((s) =>
      h('div', { class: 'use-row', dataset: { sentenceId: s.id } },
        h('div', { class: 'use-ja', lang: 'ja' }, markKanji(s.sentence, ch)),
        s.reading ? ja(s.reading, 'use-reading', 'div') : null,
        s.translation ? h('div', { class: 'use-meaning' }, s.translation) : null)))) : null;
  }
  return null;
}

async function startKanjiReview(track) {
  const items = await composeRun(track);
  if (!items.length) {
    toast('The kanji library is still downloading.');
    return;
  }
  const plan = K.cardPlan(track);
  const strokesWithGlyph = plan.steps.some((s) => s.keys.includes('glyph') && s.keys.includes('strokes'));
  startReview({
    title: 'Kanji',
    modeLabel: K.TRACK_INFO[track].label,
    track,
    items,
    plan: () => plan,
    renderPart: (item, key, asPrompt) => renderKanjiPart(item, key, asPrompt, strokesWithGlyph),
    label: (item) => ja(item.id, 'summary-item'),
    onExit: () => renderKanji(),
    again: () => composeRun(track)
  });
}
