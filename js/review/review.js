// [MODULE] review | Pure rules for self-rated reviews (words, kanji, sentences): ratings, scores, knowledge labels, progress groups for lists, run composition
// [IFACE] layer: domain | in: scores, ratings, item lists with stats -> out: new scores, state labels, run item lists | crosses: []
// [GRAPH] needs: [] | feeds: [review-ui, words-ui, sentences-ui, kanji-ui, kanji-card, selftest] | group: domain
// [STATE] stateless | persists: nothing | raises: nothing

/**
 * One scheduler for every self-rated review in the app. It started as
 * JLPT_coach's kanji scale; P26 replaced the values with Hino Lite's own:
 *
 *   rating         Didn't know -3 | Guessed -1 | Knew it +2 | Easy! +4
 *   score          0..30; the first answer starts from INITIAL_SCORE (4), so a
 *                  card you already know is learned in one sighting ("Easy!"
 *                  -> 8) and a first miss lands in unknown (-> 1)
 *   demotion       "Didn't know" on a learned card drops it to DEMOTION_SCORE (5),
 *                  two under learned -- a lapse is the signal, not a reason to
 *                  bury the card ("Knew it" -> 7, "Easy!" -> 9 earn it back). A
 *                  second miss in a row finds it at 5, which is not learned, so
 *                  it pays points like any other (-> 2, then 0).
 *                  "Guessed" is exempt: a lucky hit erodes by one instead.
 *
 * Scores follow the platform's D56 in shape: -1 means never answered, and the
 * labels are derived here and nowhere else. The thresholds are Hino Lite's own
 * (owner, 2026-11-19/20, P26; the platform takes the same scale as D73):
 *
 *   unseen -1 | unknown 0-1 | learning 2-6 | learned 7-13 | confident 14+
 *
 * The rating help shown to the learner describes the experience of answering,
 * never these numbers: a learner who knows the maths rates for points.
 */

export const UNSEEN = -1;
export const SCORE_MIN = 0;
export const SCORE_MAX = 30;
export const INITIAL_SCORE = 4;
export const LEARNING_AT = 2;          // below this a card is "unknown" (0-1)
export const LEARNED_AT = 7;
export const CONFIDENT_AT = 14;
export const DEMOTION_SCORE = LEARNED_AT - 2;

export const RATING_MISSED = -3;
export const RATING_GUESSED = -1;
export const RATING_KNEW = 2;
export const RATING_EASY = 4;

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
export const STALE_CAP_DAYS = 30;
export const CONFIDENT_FACTOR = 0.2;   // confident cards come back 5x less often than learned
const DAY_MS = 24 * 60 * 60 * 1000;

export function stateOf(score) {
  if (typeof score !== 'number' || score < 0) return STATE_UNSEEN;
  if (score >= CONFIDENT_AT) return STATE_CONFIDENT;
  if (score >= LEARNED_AT) return STATE_LEARNED;
  if (score >= LEARNING_AT) return STATE_LEARNING;
  return STATE_UNKNOWN;
}

export function isUnknown(score) {
  return stateOf(score) === STATE_UNKNOWN;
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

/** List groups by progress, least known first; ids are the D56 labels they start from. */
export const PROGRESS_GROUPS = [
  { id: STATE_UNSEEN, label: 'New' },
  { id: STATE_LEARNING, label: 'Learning' },
  { id: STATE_LEARNED, label: 'Learned' },
  { id: STATE_CONFIDENT, label: 'Confident' }
];

/**
 * The progress group of an item reviewed in several directions (owner, P18): new only if never
 * answered in any direction; learned or confident only when every direction is; anything in
 * between -- including "didn't know" -- is learning.
 */
export function progressGroup(scores) {
  const states = scores.map(stateOf);
  if (states.every((s) => s === STATE_UNSEEN)) return STATE_UNSEEN;
  if (states.every((s) => s === STATE_CONFIDENT)) return STATE_CONFIDENT;
  return isKnown(scores) ? STATE_LEARNED : STATE_LEARNING;
}

/** Items split into PROGRESS_GROUPS, least known first, empty groups left out; each keeps the items' order. */
export function groupByProgress(items, scoresOf) {
  const byGroup = new Map(PROGRESS_GROUPS.map((g) => [g.id, []]));
  items.forEach((item) => byGroup.get(progressGroup(scoresOf(item))).push(item));
  return PROGRESS_GROUPS.filter((g) => byGroup.get(g.id).length).map((g) => ({ ...g, items: byGroup.get(g.id) }));
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
 * Compose one run: strict priority tiers, each filled before the next gets a seat.
 *
 * `items` are {id, addedAt}; `statsOf(id)` returns {score, lastSeen, unknownSince}.
 *   1. unknown (0-1), oldest `unknownSince` first. They are never rested: every run
 *      shows them again until they are promoted. When there are more than a run
 *      holds, the same oldest ones come back each time (older stats without
 *      `unknownSince` rank by `lastSeen`).
 *   2. learning (2-6), stalest first, lowest score on a tie.
 *   3. only with room left, in an order set by the unknown tier:
 *      - with any unknown card, learned/confident cards are rechecked first
 *        (stale ones likelier) and new cards only fill what they leave --
 *        nothing new is taught while something is still unknown;
 *      - with none, new cards come first, then learned/confident ones.
 *      New cards are at most MAX_NEW_PER_RUN, newest first -- a fresh list of
 *      30 words gives a first run of 5.
 * The run is shorter than `size` only when every tier is spent or the cap holds.
 * The result is shuffled so the tiers do not show in blocks.
 */
export function buildRun(items, statsOf, size, { now = Date.now(), rng = Math.random } = {}) {
  const tiers = { [STATE_UNSEEN]: [], [STATE_UNKNOWN]: [], [STATE_LEARNING]: [], known: [] };
  items.forEach((item) => {
    const state = stateOf(statsOf(item.id).score);
    tiers[state === STATE_LEARNED || state === STATE_CONFIDENT ? 'known' : state].push(item);
  });
  const since = (item) => { const st = statsOf(item.id); return st.unknownSince || st.lastSeen || 0; };
  const added = (item) => item.addedAt || 0;
  const unknown = tiers[STATE_UNKNOWN].sort((a, b) => since(a) - since(b) || added(a) - added(b));
  const learning = tiers[STATE_LEARNING].sort((a, b) =>
    (statsOf(a.id).lastSeen || 0) - (statsOf(b.id).lastSeen || 0) || statsOf(a.id).score - statsOf(b.id).score);
  const fresh = tiers[STATE_UNSEEN].sort((a, b) => added(b) - added(a));

  let picked = unknown.slice(0, size);
  picked = picked.concat(learning.slice(0, size - picked.length));
  const newCards = (room) => fresh.slice(0, Math.min(MAX_NEW_PER_RUN, room));
  const recheck = (room) => weightedSample(tiers.known, (item) => maintenanceWeight(statsOf(item.id), now), room, rng);
  (unknown.length ? [recheck, newCards] : [newCards, recheck])
    .forEach((fill) => { picked = picked.concat(fill(size - picked.length)); });
  return shuffle(picked, rng);
}

/** Count items per state label for one track. */
export function countStates(items, statsOf) {
  const counts = { total: items.length };
  STATES.forEach((s) => { counts[s] = 0; });
  items.forEach((item) => { counts[stateOf(statsOf(item.id).score)] += 1; });
  return counts;
}
