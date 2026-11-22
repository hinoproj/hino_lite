// [MODULE] quiz-ui | Multiple-choice quiz of least-known items (P29): each item in steps, four options per step, right/wrong marks, Next; the summary lists only the items leaving Least known, each with Undo/Redo
// [IFACE] layer: presentation | in: a composed quiz + an adapter (steps, options, part renderers) -> out: rendered quiz/summary, quiz scores (score only, never run order) | crosses: [browser DOM]
// [GRAPH] needs: [quiz, review, storage, shell, dom] | feeds: [words-ui] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

import * as Q from './quiz.js';
import * as R from './review.js';
import * as store from '../core/storage.js';
import * as shell from '../core/shell.js';
import { $, h, button } from '../core/dom.js';

let quiz = null;   // { config, items, index, step, steps, options, picked, right, results }

/**
 * Start a quiz. `config`:
 *   title, modeLabel   heading text
 *   track              storage track id the scores go to ('words.read', ...)
 *   items              the composed quiz (quiz.quizRun output)
 *   plan(item)         [{show: [keys], ask: key}], one per step
 *   answer(item, key)  the right text for an asked key
 *   options(item, step) the step's option texts, the answer among them, in display order
 *   askLabel(key)      the line above the options ("Pick the reading")
 *   renderPart(item, key, asPrompt)  Node for a shown key, or null
 *   renderOption(text, key)          an option's content
 *   label(item)        Node naming the item in the summary
 *   onExit()           re-render the screen the quiz started from
 *   again()            a fresh quiz (items) for "Quiz again"; [] when there is none
 * Started from an open sheet, it takes over the sheet's back entry.
 */
export function startQuiz(config) {
  const back = () => exitQuiz(config);
  if (shell.sheetOpen()) {
    shell.closeSheetNow();
    shell.swapBack(back);
  } else {
    shell.enterBack(back);
  }
  begin(config, config.items);
}

function begin(config, items) {
  quiz = { config, items, index: 0, results: [] };
  startItem();
  shell.showScreen('screen-quiz');
}

function exitQuiz(config) {
  quiz = null;
  config.onExit();
}

function current() {
  return quiz.items[quiz.index];
}

function startItem() {
  quiz.steps = quiz.config.plan(current());
  quiz.step = 0;
  quiz.right = 0;
  startStep();
}

function startStep() {
  quiz.options = quiz.config.options(current(), quiz.steps[quiz.step]);
  quiz.picked = null;
  renderCard();
}

function renderCard() {
  const { config, steps, step, options, picked } = quiz;
  const item = current();
  const ask = steps[step].ask;
  const answer = config.answer(item, ask);
  const [first, ...rest] = steps[step].show;
  const shown = rest.map((key) => config.renderPart(item, key, false)).filter(Boolean);
  const lastStep = step === steps.length - 1;
  const mark = (text, i) => {
    if (picked === null) return null;
    if (text === answer) return 'correct';
    return i === picked ? 'wrong' : null;
  };

  $('screen-quiz').replaceChildren(
    h('div', { class: 'topbar' },
      button('← Quit', shell.leave, 'icon-btn ghost', { id: 'btn-quiz-quit' }),
      h('h1', null, config.title + ' ', h('span', { class: 'sub' }, config.modeLabel))),
    h('div', { class: 'run-head' },
      h('div', { class: 'run-progress' }, h('span', { style: 'width:' + (quiz.index / quiz.items.length * 100) + '%' })),
      h('div', { class: 'run-count', id: 'quiz-count' }, (quiz.index + 1) + ' / ' + quiz.items.length)),
    h('div', { class: 'review-card quiz-card' },
      h('div', { class: 'review-prompt' }, config.renderPart(item, first, true)),
      shown.length ? h('div', { class: 'review-step' }, shown) : null),
    h('p', { class: 'quiz-ask', id: 'quiz-ask' }, config.askLabel(ask)),
    h('div', { class: 'options quiz-options', id: 'quiz-options', dataset: { ask } }, options.map((text, i) =>
      h('button', {
        type: 'button',
        class: 'quiz-option' + (ask === 'meaning' ? ' text-option' : ''),
        disabled: picked !== null,
        'data-mark': mark(text, i),
        onclick: () => pick(i)
      }, config.renderOption(text, ask)))),
    picked === null ? null : h('div', { class: 'review-controls' },
      button(lastStep ? (quiz.index === quiz.items.length - 1 ? 'Finish' : 'Next word') : 'Next', next, 'primary big', { id: 'btn-quiz-next' })));
}

function pick(i) {
  if (!quiz || quiz.picked !== null) return;
  quiz.picked = i;
  if (quiz.options[i] === quiz.config.answer(current(), quiz.steps[quiz.step].ask)) quiz.right += 1;
  renderCard();
}

function next() {
  if (!quiz || quiz.picked === null) return;
  if (quiz.step < quiz.steps.length - 1) {
    quiz.step += 1;
    startStep();
    return;
  }
  record();
  quiz.index += 1;
  if (quiz.index >= quiz.items.length) finish();
  else startItem();
}

/** Score the finished item; keep copies of its entry before and after, for Undo and Redo. */
function record() {
  const { track } = quiz.config;
  const item = current();
  const before = { ...store.reviewStats(track, item.id) };
  const score = Q.quizScore(before.score, quiz.right);
  store.setQuizScore(track, item.id, score, R.isUnknown(score));
  quiz.results.push({ item, before, after: { ...store.reviewStats(track, item.id) } });
}

// --- Summary: only the items leaving Least known (owner, P29) -------------

function finish() {
  const { config, results } = quiz;
  const leaving = results.filter((r) => Q.promoted(r.before.score, r.after.score));

  $('screen-quiz-summary').replaceChildren(
    h('div', { class: 'topbar' },
      button('← Back', shell.leave, 'icon-btn ghost', { id: 'btn-quiz-summary-back' }),
      h('h1', null, config.title + ' ', h('span', { class: 'sub' }, config.modeLabel))),
    h('p', { class: 'summary-note', id: 'quiz-summary-note' }, leaving.length
      ? (leaving.length === 1 ? 'This word leaves Least known. Tap Undo to keep it there.' : 'These words leave Least known. Tap Undo to keep one there.')
      : 'No word leaves Least known this time. Every quiz brings them closer — try again soon.'),
    leaving.length ? h('div', { class: 'review-list', id: 'quiz-summary-list' }, leaving.map((r) => promotedRow(config, r))) : '',
    h('div', { class: 'actions' },
      button('Quiz again', () => {
        const items = config.again();
        if (!items.length) return;
        begin(config, items);
      }, 'primary', { id: 'btn-quiz-again' }),
      button('Done', shell.leave, 'ghost', { id: 'btn-quiz-done' })));

  shell.showScreen('screen-quiz-summary');
}

/** One leaving item: its name, where it goes, and Undo (back to Least known, its earned points cancelled) or Redo. */
function promotedRow(config, result) {
  const { track } = config;
  const row = h('div', { class: 'review-row quiz-promoted', dataset: { id: result.item.id } });
  const render = () => {
    const undone = store.reviewStats(track, result.item.id).score === result.before.score;
    const state = R.stateOf(undone ? result.before.score : result.after.score);
    row.dataset.undone = String(undone);
    row.replaceChildren(
      h('div', { class: 'item' }, config.label(result.item)),
      h('div', { class: 'state', dataset: { state } }, undone ? 'stays in Least known' : state),
      button(undone ? 'Redo' : 'Undo', () => {
        store.restoreReview(track, result.item.id, undone ? result.after : result.before);
        render();
      }, 'small ghost quiz-undo'));
  };
  render();
  return row;
}
