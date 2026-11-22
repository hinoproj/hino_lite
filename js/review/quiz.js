// [MODULE] quiz | Pure rules for the multiple-choice quiz of least-known items (P29): which items a quiz takes, answer options, the score after a quizzed item, promotion out of unknown
// [IFACE] layer: domain | in: items with stats, candidate option pools, right-step counts -> out: quiz item lists, option lists, new scores | crosses: []
// [GRAPH] needs: [review] | feeds: [quiz-ui, words-ui, selftest] | group: domain
// [STATE] stateless | persists: nothing | raises: nothing

import * as R from './review.js';

/**
 * The quiz (owner, P29) takes the items unknown in one review direction and asks each in steps,
 * every step a pick from OPTION_COUNT answers. Showing an item costs SHOW_COST, each right step
 * earns STEP_POINTS: a two-step item nets +1 at best, 0 with one right step, -1 with none; a
 * one-step item (a kana word) never gains. The scale and labels are review.js's.
 */
export const OPTION_COUNT = 4;
export const SHOW_COST = 1;
export const STEP_POINTS = 1;

/** One quiz: the items unknown in this direction, longest unknown first, up to `size`, then shuffled. */
export function quizRun(items, statsOf, size, rng = Math.random) {
  return R.shuffle(R.leastKnown(items, (item) => [statsOf(item)]).slice(0, size), rng);
}

/** The score after a quizzed item with `rightSteps` right answers, within the review scale. */
export function quizScore(score, rightSteps) {
  const base = typeof score === 'number' && score >= R.SCORE_MIN ? score : R.SCORE_MIN;
  return Math.max(R.SCORE_MIN, Math.min(R.SCORE_MAX, base - SHOW_COST + rightSteps * STEP_POINTS));
}

/** True when a quiz moved the item out of unknown in its direction (it leaves Least known there). */
export function promoted(before, after) {
  return R.isUnknown(before) && !R.isUnknown(after);
}

/**
 * The options for one step: the answer and up to OPTION_COUNT - 1 other texts, drawn at random
 * from the first pool, then the next (for words, `words.quizPools`: kana that fit the prompt
 * first, each fit from least known, then learning, then the rest). Empty texts, the answer's own
 * text and repeats are skipped. Shuffled.
 */
export function pickOptions(answer, pools, rng = Math.random) {
  const taken = new Set([answer]);
  const others = [];
  pools.forEach((pool) => {
    R.shuffle(pool, rng).forEach((text) => {
      if (others.length >= OPTION_COUNT - 1 || !text || taken.has(text)) return;
      taken.add(text);
      others.push(text);
    });
  });
  return R.shuffle([answer, ...others], rng);
}
