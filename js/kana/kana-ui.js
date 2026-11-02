// [MODULE] kana-ui | Kana tab: deck picker, mode list, timed run with the timer ring, answers, summary
// [IFACE] layer: presentation | in: DOM events on the kana screens -> out: rendered kana screens, recorded answers | crosses: [browser DOM]
// [GRAPH] needs: [kana-data, kana-srs, storage, theme, shell, dom] | feeds: [main] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

/**
 * The kana drill, unchanged in rules and screens since Kana SRS. Rules live in
 * kana-srs.js and persistence in storage.js; this file only turns events into
 * rule calls and rule results into pixels. Answers are written through to
 * storage the moment they are given, so a tablet that sleeps mid-run loses nothing.
 */

import { KANA_DATA } from './kana-data.js';
import { KanaSRS as SRS } from './kana-srs.js';
import * as store from '../core/storage.js';
import { isKids, cheer, missLine, summaryCheer } from '../core/theme.js';
import * as shell from '../core/shell.js';
import { $, notify } from '../core/dom.js';

const CIRCUMFERENCE = 2 * Math.PI * 52;
const ADVANCE_OK_MS = 650;
const ADVANCE_WRONG_MS = 1700;

const el = {};
let session = null;   // { deck, mode, queue, index, results }
let question = null;
let currentDeck = null;
const timer = { start: 0, raf: 0, running: false };
let advanceHandle = 0;

function cacheDom() {
  ['deck-grid', 'deck-title', 'run-size', 'mode-list', 'storage-notice',
    'run-title', 'run-bar', 'run-count', 'timer', 'timer-bar', 'timer-value', 'timer-tier',
    'prompt', 'prompt-hint', 'options', 'type-form', 'type-input', 'verdict',
    'stat-correct', 'stat-points', 'stat-fast', 'review-list', 'summary-title', 'summary-cheer'].forEach((id) => {
    el[id] = $(id);
  });
}

/** Count kana by state for one deck/mode pair. */
function deckStats(deck, mode) {
  const counts = { total: deck.items.length, learning: 0, learned: 0, confident: 0 };
  deck.items.forEach((item) => {
    const state = SRS.stateOf(store.kanaStats(mode, item.key).score);
    if (state === SRS.STATE_CONFIDENT) counts.confident += 1;
    else if (state === SRS.STATE_LEARNED) counts.learned += 1;
    else if (state === SRS.STATE_LEARNING) counts.learning += 1;
  });
  return counts;
}

export function meterHtml(counts) {
  const pct = (n) => (counts.total ? (n / counts.total * 100).toFixed(2) : 0) + '%';
  return '<div class="meter">' +
    '<span class="seg-confident" style="width:' + pct(counts.confident) + '"></span>' +
    '<span class="seg-learned" style="width:' + pct(counts.learned) + '"></span>' +
    '<span class="seg-learning" style="width:' + pct(counts.learning) + '"></span>' +
    '</div>';
}

export function renderKanaHome() {
  el['storage-notice'].hidden = store.isAvailable();
  el['deck-grid'].innerHTML = '';

  KANA_DATA.decks.forEach((deck) => {
    const modes = SRS.modesForDeck(deck);
    // Deck-level mastery is the average across the modes that deck offers --
    // a deck is only "done" when every mode it has is done.
    const totals = { total: deck.items.length * modes.length, learning: 0, learned: 0, confident: 0 };
    modes.forEach((mode) => {
      const c = deckStats(deck, mode);
      totals.learning += c.learning;
      totals.learned += c.learned;
      totals.confident += c.confident;
    });
    const known = totals.learned + totals.confident;

    const card = document.createElement('button');
    card.className = 'deck-card';
    card.type = 'button';
    card.innerHTML =
      '<div class="deck-name">' + deck.label + '</div>' +
      // Digraphs are twice as wide, so fewer of them fit on the sample line.
      '<div class="deck-sample" lang="ja">' + deck.items.slice(0, deck.kind === 'yoon' ? 3 : 5)
        .map((i) => i.k).join('') + '</div>' +
      meterHtml(totals) +
      '<div class="meter-label"><span>' + deck.items.length + ' kana · ' + modes.length + ' modes</span>' +
      '<span>' + Math.round(known / totals.total * 100) + '% known</span></div>';
    card.addEventListener('click', () => openDeck(deck));
    el['deck-grid'].appendChild(card);
  });

  shell.showScreen('screen-kana');
}

function renderRunSizes() {
  const current = store.getSettings().runSize;
  el['run-size'].innerHTML = '';
  SRS.RUN_SIZES.forEach((size) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(size);
    b.setAttribute('aria-pressed', String(size === current));
    b.addEventListener('click', () => {
      store.setRunSize(size);
      renderRunSizes();
    });
    el['run-size'].appendChild(b);
  });
}

/** From the deck picker: one back step returns to it. */
function openDeck(deck) {
  shell.enterBack(renderKanaHome);
  showDeck(deck);
}

function showDeck(deck) {
  currentDeck = deck;
  el['deck-title'].innerHTML = deck.label + ' <span class="sub">' + deck.items.length + ' kana</span>';
  renderRunSizes();
  renderModeList();
  shell.showScreen('screen-kana-deck');
}

function renderModeList() {
  el['mode-list'].innerHTML = '';
  SRS.modesForDeck(currentDeck).forEach((mode) => {
    const info = SRS.MODE_INFO[mode];
    const counts = deckStats(currentDeck, mode);
    const row = document.createElement('div');
    row.className = 'mode-row';
    row.innerHTML =
      '<div><div class="mode-name">' + info.label + '</div>' +
      '<div class="mode-desc">' + info.description + '</div></div>' +
      '<div></div>' +
      '<div class="mode-progress">' + meterHtml(counts) +
      '<div class="meter-label"><span>' + counts.confident + ' confident · ' + counts.learned +
      ' learned · ' + counts.learning + ' learning</span><span>' +
      (counts.total - counts.learning - counts.learned - counts.confident) + ' new</span></div></div>';

    const start = document.createElement('button');
    start.className = 'primary';
    start.type = 'button';
    start.textContent = 'Start';
    start.addEventListener('click', () => {
      shell.enterBack(quitToDeck);
      startRun(currentDeck, mode);
    });
    row.children[1].appendChild(start);

    el['mode-list'].appendChild(row);
  });
}

// --- Run lifecycle ---------------------------------------------------

function quitToDeck() {
  clearTimeout(advanceHandle);
  stopTimer(true);
  showDeck(session ? session.deck : currentDeck);
}

function startRun(deck, mode) {
  const size = store.getSettings().runSize;
  const queue = SRS.buildRun(deck, (key) => store.kanaStats(mode, key), size);
  if (!queue.length) {
    notify('This deck has no cards to show.');
    shell.leave();
    return;
  }
  session = { deck, mode, queue, index: 0, results: [] };
  el['run-title'].innerHTML = deck.label + ' <span class="sub">' + SRS.MODE_INFO[mode].label + '</span>';
  shell.showScreen('screen-kana-run');
  nextQuestion();
}

function nextQuestion() {
  clearTimeout(advanceHandle);
  if (session.index >= session.queue.length) {
    finishRun();
    return;
  }
  const item = session.queue[session.index];
  question = SRS.buildQuestion(item, session.deck, session.mode, store.kanaStats(session.mode, item.key).misses);

  el['run-count'].textContent = (session.index + 1) + ' / ' + session.queue.length;
  el['run-bar'].style.width = (session.index / session.queue.length * 100) + '%';
  el.verdict.textContent = '';
  el.verdict.removeAttribute('data-mark');

  const romajiPrompt = session.mode === SRS.MODE_MCQ_R2K;
  el.prompt.textContent = question.prompt;
  el.prompt.className = 'prompt' + (romajiPrompt ? ' romaji' : '');
  el['prompt-hint'].textContent = romajiPrompt ? 'Pick the kana' :
    (session.mode === SRS.MODE_TYPE ? 'Type the rōmaji' : 'Pick the rōmaji');

  if (question.options) {
    renderOptions();
    el.options.hidden = false;
    el['type-form'].hidden = true;
  } else {
    el.options.hidden = true;
    el['type-form'].hidden = false;
    el['type-form'].removeAttribute('data-mark');
    el['type-input'].value = '';
    el['type-input'].disabled = false;
    el['type-input'].focus();
  }

  if (question.timed) startTimer(); else stopTimer(true);
}

function renderOptions() {
  el.options.innerHTML = '';
  const romajiOptions = session.mode === SRS.MODE_MCQ_K2R;
  question.options.forEach((opt) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = opt.text;
    if (romajiOptions) b.className = 'romaji-option';
    else b.lang = 'ja';
    b.addEventListener('click', () => answerMcq(opt, b));
    el.options.appendChild(b);
  });
}

// --- Timer widget ----------------------------------------------------

/**
 * The ring drains over the 5s window that still earns bonus points and then
 * stops: past that every correct answer is worth +1, so a ring that kept
 * shrinking would imply a deadline the scoring does not actually have.
 */
function startTimer() {
  el.timer.hidden = false;
  timer.start = performance.now();
  timer.running = true;
  tickTimer();
}

function tickTimer() {
  if (!timer.running) return;
  const elapsed = performance.now() - timer.start;
  const ratio = Math.min(1, elapsed / SRS.OK_MS);
  el['timer-bar'].setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * ratio));
  el['timer-value'].textContent = (elapsed / 1000).toFixed(1);

  const tier = elapsed <= SRS.FAST_MS ? 'fast' : (elapsed <= SRS.OK_MS ? 'ok' : 'slow');
  el.timer.setAttribute('data-tier', tier);
  el['timer-tier'].textContent = tier === 'fast' ? '+5' : (tier === 'ok' ? '+3' : '+1');

  timer.raf = requestAnimationFrame(tickTimer);
}

function stopTimer(hide) {
  timer.running = false;
  cancelAnimationFrame(timer.raf);
  if (hide) el.timer.hidden = true;
}

// --- Answering -------------------------------------------------------

function answerMcq(opt, buttonEl) {
  if (!question || question.answered) return;
  const elapsed = performance.now() - timer.start;
  question.answered = true;
  stopTimer(false);

  Array.from(el.options.children).forEach((child) => { child.disabled = true; });
  buttonEl.setAttribute('data-mark', opt.correct ? 'correct' : 'wrong');
  if (!opt.correct) {
    Array.from(el.options.children).forEach((child, i) => {
      if (question.options[i].correct) child.setAttribute('data-mark', 'correct');
    });
  }
  commitAnswer(opt.correct, elapsed, opt.correct ? null : opt.key);
}

function answerTyped(raw) {
  if (!question || question.answered) return;
  question.answered = true;
  const correct = SRS.checkTyped(raw, question.item);
  el['type-form'].setAttribute('data-mark', correct ? 'correct' : 'wrong');
  el['type-input'].disabled = true;
  commitAnswer(correct, 0, null);
}

/** `wrongKey` is the kana of a wrongly tapped option; typed answers have none. */
function commitAnswer(correct, elapsed, wrongKey) {
  const key = question.item.key;
  const before = store.kanaStats(session.mode, key);
  const points = SRS.pointsFor(session.mode, correct, elapsed);
  const score = SRS.applyPoints(before.score, points);
  const misses = wrongKey ? SRS.pushMiss(before.misses, wrongKey) : before.misses;
  store.recordKana(session.mode, key, score, misses, correct);

  // Report the points the answer EARNED, not the net change to the score.
  // A wrong answer against a kana already at 0 changes nothing, and showing
  // that as "Wrong +0" reads like the miss was free.
  session.results.push({ item: question.item, correct, elapsed, points, after: score });

  const headline = isKids() ? (correct ? cheer() : missLine()) : (correct ? 'Correct' : 'Wrong');
  el.verdict.setAttribute('data-mark', correct ? 'correct' : 'wrong');
  el.verdict.innerHTML = headline + ' ' + (points >= 0 ? '+' : '') + points +
    '<span class="detail"><span lang="ja">' + question.item.k + '</span> = ' + question.item.r +
    ' · score ' + score + ' (' + SRS.stateOf(score) + ')</span>';

  session.index += 1;
  advanceHandle = setTimeout(nextQuestion, correct ? ADVANCE_OK_MS : ADVANCE_WRONG_MS);
}

// --- Summary ---------------------------------------------------------

function finishRun() {
  stopTimer(true);
  const correct = session.results.filter((r) => r.correct).length;
  const points = session.results.reduce((sum, r) => sum + r.points, 0);
  const fast = session.results.filter((r) =>
    r.correct && SRS.MODE_INFO[session.mode].timed && r.elapsed <= SRS.FAST_MS).length;

  el['summary-title'].innerHTML = session.deck.label +
    ' <span class="sub">' + SRS.MODE_INFO[session.mode].label + '</span>';
  el['stat-correct'].textContent = correct + '/' + session.results.length;
  el['stat-points'].textContent = (points >= 0 ? '+' : '') + points;
  el['stat-fast'].textContent = SRS.MODE_INFO[session.mode].timed ? String(fast) : '—';

  el['summary-cheer'].hidden = !isKids();
  el['summary-cheer'].textContent = summaryCheer(correct / session.results.length);

  el['review-list'].innerHTML = '';
  session.results.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'review-row';
    row.innerHTML =
      '<div class="kana" lang="ja">' + r.item.k + '</div>' +
      '<div>' + r.item.r + ' <span class="sub">· ' + SRS.stateOf(r.after) + ' (' + r.after + ')</span></div>' +
      '<div class="delta ' + (r.points >= 0 ? 'up' : 'down') + '">' +
      (r.points >= 0 ? '+' : '') + r.points + '</div>';
    el['review-list'].appendChild(row);
  });

  // Back from the summary returns to the deck, same as the buttons.
  const deck = session.deck;
  shell.swapBack(() => showDeck(deck));
  shell.showScreen('screen-kana-summary');
}

// --- Wiring ----------------------------------------------------------

export function initKana() {
  cacheDom();
  $('btn-kana-decks').addEventListener('click', shell.leave);
  $('btn-quit').addEventListener('click', shell.leave);
  $('btn-summary-deck').addEventListener('click', shell.leave);
  $('btn-to-deck').addEventListener('click', shell.leave);
  $('btn-again').addEventListener('click', () => {
    shell.swapBack(quitToDeck);
    startRun(session.deck, session.mode);
  });
  el['type-form'].addEventListener('submit', (e) => {
    e.preventDefault();
    if (question && question.answered) return;
    answerTyped(el['type-input'].value);
  });
}
