// [MODULE] review | Pure rules for self-rated reviews (words and kanji): ratings, scores, knowledge labels, run composition
// [IFACE] layer: domain | in: scores, ratings, item lists with stats -> out: new scores, state labels, run item lists | crosses: []
// [GRAPH] needs: [] | feeds: [review-ui, words-ui, kanji-ui, kanji-card, selftest] | group: domain
// [STATE] stateless | persists: nothing | raises: nothing

/**
 * One scheduler for every self-rated review in the app. It is JLPT_coach's
 * kanji scale, which the platform names as its reference:
 *
 *   rating         Didn't know -3 | Guessed -1 | Knew it +1 | Easy! +2
 *   score          0..30; the first answer starts from INITIAL_SCORE (3), so
 *                  a word you already know costs one sighting ("Easy!" -> 5),
 *                  and one miss cancels the credit exactly (-> 0)
 *   demotion       "Didn't know" on a learned card drops it to 4 -- a lapse is
 *                  the signal, not a reason to bury the card. "Guessed" is
 *                  exempt: a lucky hit erodes by one instead.
 *
 * Scores follow the platform's D56: -1 means never answered, and the labels
 * are derived here and nowhere else:
 *
 *   unseen -1 | unknown 0 | learning 1-4 | learned 5-14 | confident 15+
 *
 * The rating help shown to the learner describes the experience of answering,
 * never these numbers: a learner who knows the maths rates for points.
 */

export const UNSEEN = -1;
export const SCORE_MIN = 0;
export const SCORE_MAX = 30;
export const INITIAL_SCORE = 3;
export const LEARNED_AT = 5;
export const CONFIDENT_AT = 15;
export const DEMOTION_SCORE = 4;

export const RATING_MISSED = -3;
export const RATING_GUESSED = -1;
export const RATING_KNEW = 1;
export const RATING_EASY = 2;

// Order is the button order, lowest first.
export const RATINGS = [
  { value: RATING_MISSED, id: 'missed', label: "Didn't know" },
  { value: RATING_GUESSED, id: 'guessed', label: 'Guessed' },
  { value: RATING_KNEW, id: 'knew', label: 'Knew it' },
  { value: RATING_EASY, id: 'easy', label: 'Easy!' }
];

export const STATE_UNSEEN = 'unseen';
export const STATE_UNKNOWN = 'unknown';
export const STATE_LEARNING = 'learning';
export const STATE_LEARNED = 'learned';
export const STATE_CONFIDENT = 'confident';
export const STATES = [STATE_UNSEEN, STATE_UNKNOWN, STATE_LEARNING, STATE_LEARNED, STATE_CONFIDENT];

export const RUN_SIZES = [10, 15, 20];
export const MAX_NEW_PER_RUN = 5;
export const MAX_MAINTENANCE_PER_RUN = 3;
export const STALE_CAP_DAYS = 30;
export const CONFIDENT_FACTOR = 0.2;   // confident cards come back 5x less often than learned
const DAY_MS = 24 * 60 * 60 * 1000;

export function stateOf(score) {
  if (typeof score !== 'number' || score < 0) return STATE_UNSEEN;
  if (score >= CONFIDENT_AT) return STATE_CONFIDENT;
  if (score >= LEARNED_AT) return STATE_LEARNED;
  if (score > 0) return STATE_LEARNING;
  return STATE_UNKNOWN;
}

export function isRating(value) {
  return RATINGS.some((r) => r.value === value);
}

/** New score after a rating. An unseen card starts from INITIAL_SCORE. */
export function applyRating(score, rating) {
  const base = typeof score === 'number' && score >= 0 ? score : INITIAL_SCORE;
  const next = rating <= RATING_MISSED && base >= LEARNED_AT ? DEMOTION_SCORE : base + rating;
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, next));
}

/** Score for "Mark as known": never lowers a card that is already past it. */
export function knownScore(score) {
  return Math.max(typeof score === 'number' ? score : UNSEEN, LEARNED_AT);
}

/** True when every direction's score is at least learned: "Mark as known" has nothing left to do. */
export function isKnown(scores) {
  return scores.length > 0 && scores.every((score) => typeof score === 'number' && score >= LEARNED_AT);
}

export function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How strongly a learned/confident card asks to come back: staler = likelier. */
export function maintenanceWeight(stats, now) {
  const days = Math.min(STALE_CAP_DAYS, Math.max(0, (now - (stats.lastSeen || 0)) / DAY_MS));
  return (1 + days) * (stats.score >= CONFIDENT_AT ? CONFIDENT_FACTOR : 1);
}

function weightedSample(pool, weightOf, count, rng) {
  const rest = pool.slice();
  const picked = [];
  while (picked.length < count && rest.length) {
    const weights = rest.map(weightOf);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let idx = 0;
    while (idx < rest.length - 1 && roll >= weights[idx]) {
      roll -= weights[idx];
      idx += 1;
    }
    picked.push(rest[idx]);
    rest.splice(idx, 1);
  }
  return picked;
}

/**
 * Compose one run.
 *
 * `items` are {id, addedAt}; `statsOf(id)` returns {score, lastSeen}. The run takes
 *   - up to MAX_NEW_PER_RUN unseen cards, newest first (what was just added is fresh),
 *   - up to MAX_MAINTENANCE_PER_RUN learned/confident cards, stale ones likelier,
 *   - and fills the rest with cards in progress (unknown/learning), stalest first.
 * When that leaves the run short, it backfills with more maintenance -- a run
 * should not shrink just because the learner is doing well. The new-card cap
 * is hard, though: a fresh list of 30 words gives a first run of 5, not 10 new
 * words at once. The result is shuffled so new cards do not all come first.
 */
export function buildRun(items, statsOf, size, { now = Date.now(), rng = Math.random } = {}) {
  const fresh = [];
  const inProgress = [];
  const known = [];
  items.forEach((item) => {
    const st = statsOf(item.id);
    const state = stateOf(st.score);
    if (state === STATE_UNSEEN) fresh.push(item);
    else if (state === STATE_LEARNED || state === STATE_CONFIDENT) known.push(item);
    else inProgress.push(item);
  });
  fresh.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  inProgress.sort((a, b) => (statsOf(a.id).lastSeen || 0) - (statsOf(b.id).lastSeen || 0));

  const weightOf = (item) => maintenanceWeight(statsOf(item.id), now);
  const takeNew = fresh.slice(0, Math.min(MAX_NEW_PER_RUN, size));
  const maintenance = weightedSample(known, weightOf, Math.min(MAX_MAINTENANCE_PER_RUN, size - takeNew.length), rng);
  let picked = takeNew.concat(maintenance);
  picked = picked.concat(inProgress.slice(0, Math.max(0, size - picked.length)));

  if (picked.length < size) {
    const chosen = new Set(picked.map((i) => i.id));
    picked = picked.concat(weightedSample(known.filter((i) => !chosen.has(i.id)), weightOf, size - picked.length, rng));
  }
  return shuffle(picked, rng);
}

/** Count items per state label for one track. */
export function countStates(items, statsOf) {
  const counts = { total: items.length };
  STATES.forEach((s) => { counts[s] = 0; });
  items.forEach((item) => { counts[stateOf(statsOf(item.id).score)] += 1; });
  return counts;
}
