// [MODULE] review-ui | Self-rated review run for words and kanji: step-by-step reveal, four rating buttons, help sheet, summary; shared track panel, state dots and progress rows
// [IFACE] layer: presentation | in: a composed run + an adapter (card plan, part renderers) -> out: rendered run/summary, recorded ratings | crosses: [browser DOM]
// [GRAPH] needs: [review, storage, theme, shell, dom] | feeds: [words-ui, kanji-ui, kanji-card] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

import * as R from './review.js';
import * as store from '../core/storage.js';
import { isKids, cheer, summaryCheer } from '../core/theme.js';
import * as shell from '../core/shell.js';
import { $, h, button, segmented } from '../core/dom.js';

const RATING_HINTS = { missed: 'nothing came', guessed: 'not sure', knew: 'got it', easy: 'instantly' };
const CHEER_MS = 700;

let run = null;   // { config, items, index, revealed, results }

// --- Panels shared by the Words and Kanji tabs ---------------------------

/** Two small bars, one per track, coloured by knowledge label. */
export function stateDots(track1State, track2State) {
  return h('span', { class: 'state-dots', 'aria-hidden': 'true' },
    h('i', { dataset: { state: track1State } }), h('i', { dataset: { state: track2State } }));
}

/**
 * One review direction in a card's progress panel (word sheet, kanji card):
 * its name, its state, and four steps lit up to the state. No points (contract 9).
 */
export function trackRow(label, state) {
  const lit = R.STATES.indexOf(state);     // unseen 0 ... confident 4
  return h('div', { class: 'track', dataset: { state } },
    h('span', { class: 'track-name' }, label),
    h('span', { class: 'track-state' }, state),
    h('span', { class: 'track-steps', 'aria-hidden': 'true' },
      [1, 2, 3, 4].map((step) => h('i', { class: step <= lit ? 'lit' : null }))));
}

export function meter(counts) {
  const pct = (n) => (counts.total ? (n / counts.total * 100).toFixed(2) : 0) + '%';
  return h('div', { class: 'meter' },
    h('span', { class: 'seg-confident', style: 'width:' + pct(counts.confident) }),
    h('span', { class: 'seg-learned', style: 'width:' + pct(counts.learned) }),
    h('span', { class: 'seg-learning', style: 'width:' + pct(counts.learning + counts.unknown) }));
}

/**
 * Run length + one row per track (label, counts meter, Start). `itemsOf()`
 * returns the items as {id, addedAt}; `onStart(track)` starts that track's run.
 */
export function trackPanel(tracks, info, itemsOf, onStart, { disabled = false } = {}) {
  const items = itemsOf();
  return h('div', { class: 'panel review-panel' },
    h('div', { class: 'field-row' }, h('span', null, 'Cards per run'),
      segmented(R.RUN_SIZES, store.getSettings().runSize, (size) => {
        store.setRunSize(size);
        shell.goTab(shell.activeTab());
      }, 'Cards per run')),
    tracks.map((track) => {
      const counts = R.countStates(items, (id) => store.reviewStats(track, id));
      const known = counts.learned + counts.confident;
      return h('div', { class: 'mode-row', dataset: { track } },
        h('div', null, h('div', { class: 'mode-name' }, info[track].label),
          h('div', { class: 'mode-desc' }, info[track].description)),
        button('Start', () => onStart(track), 'primary', { disabled: disabled || !items.length }),
        h('div', { class: 'mode-progress' }, meter(counts),
          h('div', { class: 'meter-label' },
            h('span', null, counts.confident + ' confident · ' + counts.learned + ' learned · ' +
              (counts.learning + counts.unknown) + ' learning'),
            h('span', null, counts.unseen + ' new · ' + Math.round(counts.total ? known / counts.total * 100 : 0) + '% known'))));
    }));
}

// --- The run -------------------------------------------------------------

/**
 * Start a run. `config`:
 *   title, modeLabel   heading text
 *   track              storage track id ('words.read', 'kanji.recall', ...)
 *   items              the composed run (review.buildRun output), each {id, ...}
 *   plan(item)         {prompt: key, steps: [{button, keys: [...]}]}
 *   renderPart(item, key, asPrompt)  Node, or null when the item has nothing for that key
 *   label(item)        Node naming the item in the summary
 *   onExit()           re-render the screen the run started from
 *   again()            a fresh run (items, or a promise of them) for "Run again"; [] when there is none
 */
export function startReview(config) {
  shell.enterBack(() => exitRun(config));
  begin(config, config.items);
}

function begin(config, items) {
  run = { config, items, index: 0, revealed: 0, results: [], advancing: 0 };
  shell.showScreen('screen-review');
  renderCard();
}

function exitRun(config) {
  if (run) clearTimeout(run.advancing);
  run = null;
  config.onExit();
}

function current() {
  return run.items[run.index];
}

function stepsOf(item) {
  const plan = run.config.plan(item);
  // Drop steps with nothing to show (e.g. no example and no notes), keep their order.
  const steps = plan.steps
    .map((s) => ({ button: s.button, nodes: s.keys.map((k) => run.config.renderPart(item, k, false)).filter(Boolean) }))
    .filter((s) => s.nodes.length);
  return { prompt: run.config.renderPart(item, plan.prompt, true), steps };
}

function renderCard() {
  const item = current();
  const { prompt, steps } = stepsOf(item);
  const done = run.revealed >= steps.length;
  const screen = $('screen-review');

  const card = h('div', {
    class: 'review-card', role: 'button', tabindex: '0', 'aria-label': done ? 'Card' : steps[run.revealed].button,
    onclick: () => revealNext(steps.length),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); revealNext(steps.length); } }
  },
  h('div', { class: 'review-prompt' }, prompt),
  steps.slice(0, run.revealed).map((s) => h('div', { class: 'review-step' }, s.nodes)));

  const controls = done
    ? h('div', { class: 'review-controls' },
      h('div', { class: 'rating-row' }, R.RATINGS.map((r) =>
        h('button', { type: 'button', class: 'rating ' + r.id, dataset: { rating: String(r.value) }, onclick: () => rate(r.value) },
          h('span', { class: 'rating-hint' }, RATING_HINTS[r.id]), h('b', null, r.label)))),
      button('Which one do I press?', openHelp, 'link-btn', { id: 'btn-rating-help' }))
    : h('div', { class: 'review-controls' },
      button(steps[run.revealed].button, () => revealNext(steps.length), 'primary big', { id: 'btn-reveal' }),
      steps.length - run.revealed > 1
        ? button('Show all', () => { run.revealed = steps.length; renderCard(); }, 'ghost', { id: 'btn-reveal-all' })
        : null);

  screen.replaceChildren(
    h('div', { class: 'topbar' },
      button('← Quit', shell.leave, 'icon-btn ghost', { id: 'btn-review-quit' }),
      h('h1', null, run.config.title + ' ', h('span', { class: 'sub' }, run.config.modeLabel))),
    h('div', { class: 'run-head' },
      h('div', { class: 'run-progress' }, h('span', { style: 'width:' + (run.index / run.items.length * 100) + '%' })),
      h('div', { class: 'run-count', id: 'review-count' }, (run.index + 1) + ' / ' + run.items.length)),
    card,
    controls,
    h('div', { class: 'verdict', id: 'review-verdict' }));
}

function revealNext(total) {
  if (!run || run.revealed >= total) return;
  run.revealed += 1;
  renderCard();
}

function rate(value) {
  if (!run || run.advancing) return;
  const item = current();
  const before = store.reviewStats(run.config.track, item.id).score;
  const after = R.applyRating(before, value);
  store.recordReview(run.config.track, item.id, after);
  run.results.push({ item, rating: value, before, after });

  const good = value >= R.RATING_KNEW;
  if (isKids() && good) {
    const verdict = $('review-verdict');
    verdict.textContent = cheer();
    verdict.setAttribute('data-mark', 'correct');
    document.querySelectorAll('#screen-review .rating').forEach((b) => { b.disabled = true; });
    run.advancing = setTimeout(advance, CHEER_MS);
  } else {
    advance();
  }
}

function advance() {
  if (!run) return;
  run.advancing = 0;
  run.index += 1;
  run.revealed = 0;
  if (run.index >= run.items.length) finish();
  else renderCard();
}

// --- Summary ---------------------------------------------------------

function finish() {
  const { config, results } = run;
  const count = (v) => results.filter((r) => r.rating === v).length;
  const good = results.filter((r) => r.rating >= R.RATING_KNEW).length;
  const newlyLearned = results.filter((r) =>
    r.after >= R.LEARNED_AT && (r.before < R.LEARNED_AT));

  const screen = $('screen-review-summary');
  screen.replaceChildren(
    h('div', { class: 'topbar' },
      button('← Back', shell.leave, 'icon-btn ghost', { id: 'btn-review-summary-back' }),
      h('h1', null, config.title + ' ', h('span', { class: 'sub' }, config.modeLabel))),
    isKids() ? h('div', { class: 'summary-cheer' }, summaryCheer(good / results.length)) : null,
    h('div', { class: 'stat-grid four', id: 'review-stats' }, R.RATINGS.slice().reverse().map((r) =>
      h('div', { class: 'stat ' + r.id }, h('div', { class: 'value' }, String(count(r.value))),
        h('div', { class: 'label' }, r.label)))),
    newlyLearned.length
      ? h('p', { class: 'summary-note' }, 'Learned this run: ', newlyLearned.map((r) => config.label(r.item)))
      : null,
    h('div', { class: 'review-list', id: 'review-summary-list' }, results.map((r) =>
      h('div', { class: 'review-row' },
        h('div', { class: 'item' }, config.label(r.item)),
        h('div', { class: 'state', dataset: { state: R.stateOf(r.after) } }, R.stateOf(r.after)),
        h('div', { class: 'rated ' + R.RATINGS.find((x) => x.value === r.rating).id },
          R.RATINGS.find((x) => x.value === r.rating).label)))),
    h('div', { class: 'actions' },
      button('Run again', async () => {
        const items = await config.again();
        if (!items.length) return;
        shell.swapBack(() => exitRun(config));
        begin(config, items);
      }, 'primary', { id: 'btn-review-again' }),
      button('Done', shell.leave, 'ghost', { id: 'btn-review-done' })));

  shell.swapBack(() => exitRun(config));
  shell.showScreen('screen-review-summary');
}

// --- Help ------------------------------------------------------------

/**
 * Describes what answering FEELS like, never the points: a learner who knows
 * the maths presses for the number instead of telling the truth, and the
 * review can only pace itself around honest answers.
 */
function openHelp() {
  const rows = [
    ['missed', 'Nothing came.', 'You did not know it, or what you thought was wrong. That is fine — this button brings the card back soon.'],
    ['guessed', 'Right, but you were not sure.', 'It felt like a lucky guess. Pick this whenever you were relieved before you were sure.'],
    ['knew', 'It came to you.', 'Maybe you needed a moment, but you knew it.'],
    ['easy', 'Instant and certain.', 'No waiting, no doubt. This is how a card earns its rest.']
  ];
  shell.openSheet(h('div', { class: 'help', id: 'rating-help' },
    h('div', { class: 'sheet-head' }, h('h2', null, 'Which one do I press?'),
      button('✕', shell.closeSheet, 'icon-btn ghost', { 'aria-label': 'Close' })),
    h('p', { class: 'muted' }, 'Ask yourself: did it come to you, or did you land on it? Be honest — the app can only help with what you really know.'),
    rows.map(([id, head, body]) => h('div', { class: 'help-row' },
      h('span', { class: 'rating-key ' + id }, R.RATINGS.find((r) => r.id === id).label),
      h('div', null, h('b', null, head), h('p', null, body)))),
    h('p', { class: 'muted' }, 'Can’t decide between two? Pick the lower one.')), { label: 'Which one do I press?' });
}
