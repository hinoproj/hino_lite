// [MODULE] storage | The learner's data: settings, kana scores, words, kanji list, review scores; backup export/import
// [IFACE] layer: infrastructure | in: records computed by the rule modules, backup JSON -> out: reads, export text | crosses: [browser localStorage, StorageManager]
// [GRAPH] needs: [] | feeds: [main, theme, backup, shell, kana-ui, words-ui, review-ui, kanji-ui, kanji-card, settings-ui, selftest] | group: infrastructure
// [STATE] stateful | persists: localStorage key hino_lite_v2 | raises: nothing (every storage access is guarded)

/**
 * The only module that touches localStorage. Everything lives in one JSON
 * document under STORAGE_KEY, which is also the backup file format:
 *
 *   { app: 'hino_lite', version: 2, updatedAt, unsavedSince,
 *     settings: { runSize, theme, lastBackupAt },
 *     kana:    { <kana mode>: { <kana>: {score, seen, right, lastSeen, misses} } },
 *     words:   { <id>: {id, writing, reading, meaning, example, notes, createdAt, updatedAt} },
 *     kanji:   { <kanji>: {addedAt, removed} },
 *     reviews: { <track>: { <word id | kanji>: {score, seen, lastSeen} } } }
 *
 * Review tracks are 'words.read', 'words.recall', 'kanji.read', 'kanji.recall'.
 * A missing review entry means never answered (score -1, D56). A removed kanji
 * keeps its review entries, so adding it back restores its progress.
 *
 * Every value arrives already computed by a rule module (srs, review, words);
 * this module stores it and applies no rule of its own. A shape change needs a
 * new version and a migration in normalize(); a purely additive field that
 * normalize() defaults may stay under the same version.
 */

export const STORAGE_KEY = 'hino_lite_v2';
export const APP_ID = 'hino_lite';
export const VERSION = 2;

// Theme ids double as the data-theme value css/app.css keys its palettes on.
export const THEMES = ['dark', 'light', 'kids'];
const DEFAULT_THEME = 'dark';
const RUN_SIZES = [10, 15, 20];
const DEFAULT_RUN_SIZE = 15;
export const BACKUP_NUDGE_MS = 7 * 24 * 60 * 60 * 1000;

const WORD_FIELDS = ['writing', 'reading', 'meaning', 'example', 'notes'];
const EMPTY_KANA = Object.freeze({ score: 0, seen: 0, right: 0, lastSeen: 0, misses: Object.freeze([]) });
const UNSEEN_REVIEW = Object.freeze({ score: -1, seen: 0, lastSeen: 0 });

let available = false;
let state = blankState();

function blankState() {
  return {
    app: APP_ID,
    version: VERSION,
    updatedAt: 0,
    unsavedSince: 0,
    settings: { runSize: DEFAULT_RUN_SIZE, theme: DEFAULT_THEME, lastBackupAt: 0 },
    kana: {},
    words: {},
    kanji: {},
    reviews: {}
  };
}

const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v) => (typeof v === 'string' ? v : '');
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Rebuild a state from untrusted JSON (saved data or an imported file). */
export function normalize(raw) {
  const next = blankState();
  const src = obj(raw);
  const settings = obj(src.settings);
  if (RUN_SIZES.includes(settings.runSize)) next.settings.runSize = settings.runSize;
  if (THEMES.includes(settings.theme)) next.settings.theme = settings.theme;
  next.settings.lastBackupAt = num(settings.lastBackupAt);
  next.updatedAt = num(src.updatedAt);
  next.unsavedSince = num(src.unsavedSince);

  Object.entries(obj(src.kana)).forEach(([mode, entries]) => {
    next.kana[mode] = {};
    Object.entries(obj(entries)).forEach(([key, e]) => {
      const entry = obj(e);
      next.kana[mode][key] = {
        score: Math.max(0, num(entry.score)),
        seen: num(entry.seen),
        right: num(entry.right),
        lastSeen: num(entry.lastSeen),
        misses: Array.isArray(entry.misses) ? entry.misses.filter((k) => typeof k === 'string') : []
      };
    });
  });

  Object.values(obj(src.words)).forEach((w) => {
    const word = obj(w);
    if (!str(word.id)) return;
    const clean = { id: word.id, createdAt: num(word.createdAt), updatedAt: num(word.updatedAt) };
    WORD_FIELDS.forEach((f) => { clean[f] = str(word[f]); });
    next.words[word.id] = clean;
  });

  Object.entries(obj(src.kanji)).forEach(([ch, e]) => {
    const entry = obj(e);
    next.kanji[ch] = { addedAt: num(entry.addedAt), removed: entry.removed === true };
  });

  Object.entries(obj(src.reviews)).forEach(([track, entries]) => {
    next.reviews[track] = {};
    Object.entries(obj(entries)).forEach(([id, e]) => {
      const entry = obj(e);
      const score = num(entry.score, -1);
      if (score < 0) return;      // never answered: absent, as D56 has it
      next.reviews[track][id] = { score, seen: num(entry.seen), lastSeen: num(entry.lastSeen) };
    });
  });
  return next;
}

function backend() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__hino_lite_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch (err) {
    console.warn('[storage.js][backend] localStorage unavailable, running in memory: ' + err.message);
    return null;
  }
}

export function load() {
  const ls = backend();
  available = Boolean(ls);
  if (!ls) return state;
  try {
    const text = ls.getItem(STORAGE_KEY);
    state = text ? normalize(JSON.parse(text)) : blankState();
  } catch (err) {
    console.error('[storage.js][load] could not read saved data, starting fresh: ' + err.message);
    state = blankState();
  }
  return state;
}

export function save() {
  state.updatedAt = Date.now();
  if (!available) return false;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('[storage.js][save] could not persist data: ' + err.message);
    available = false;
    return false;
  }
}

/** Record that learner data changed since the last backup, then persist. */
function touch() {
  if (!state.unsavedSince) state.unsavedSince = Date.now();
  save();
}

export function isAvailable() {
  return available;
}

/** Ask the browser not to clear this site's storage under pressure. Resolves to true when granted. */
export async function requestPersistence() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn('[storage.js][requestPersistence] persistence request failed: ' + err.message);
    return false;
  }
}

export async function isPersisted() {
  try {
    return Boolean(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted());
  } catch (err) {
    console.warn('[storage.js][isPersisted] could not query persistence: ' + err.message);
    return false;
  }
}

// --- Settings -----------------------------------------------------------

export function getSettings() {
  return state.settings;
}

export function setRunSize(size) {
  if (!RUN_SIZES.includes(size)) return;
  state.settings.runSize = size;
  save();
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) {
    console.warn('[storage.js][setTheme] unknown theme ignored: ' + theme);
    return;
  }
  state.settings.theme = theme;
  save();
}

// --- Kana ---------------------------------------------------------------

export function kanaStats(mode, key) {
  const entries = state.kana[mode];
  return (entries && entries[key]) || EMPTY_KANA;
}

/** Store one kana answer: the new score and miss list, as computed by kana-srs. */
export function recordKana(mode, key, score, misses, correct) {
  if (!state.kana[mode]) state.kana[mode] = {};
  const entry = state.kana[mode][key] || { score: 0, seen: 0, right: 0, lastSeen: 0, misses: [] };
  entry.score = score;
  entry.misses = misses.slice();
  entry.seen += 1;
  if (correct) entry.right += 1;
  entry.lastSeen = Date.now();
  state.kana[mode][key] = entry;
  touch();
}

// --- Words --------------------------------------------------------------

function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function listWords() {
  return Object.values(state.words);
}

export function getWord(id) {
  return state.words[id] || null;
}

/** Insert or update a word (already cleaned and validated by `words`). Returns the stored copy. */
export function saveWord(fields, id) {
  const now = Date.now();
  const existing = id ? state.words[id] : null;
  const word = existing ? { ...existing } : { id: newId(), createdAt: now };
  WORD_FIELDS.forEach((f) => { word[f] = str(fields[f]); });
  word.updatedAt = now;
  state.words[word.id] = word;
  touch();
  return word;
}

/** Delete a word and its review scores. The caller has the learner's confirmation. */
export function deleteWord(id) {
  if (!state.words[id]) return;
  delete state.words[id];
  Object.keys(state.reviews).forEach((track) => {
    if (track.startsWith('words.')) delete state.reviews[track][id];
  });
  touch();
}

// --- Kanji list ---------------------------------------------------------

export function kanjiEntry(ch) {
  return state.kanji[ch] || null;
}

export function isEnrolled(ch) {
  const entry = state.kanji[ch];
  return Boolean(entry && !entry.removed);
}

/** Kanji in the learner's list, as {id, addedAt} (the shape review.buildRun takes). */
export function listKanji() {
  return Object.entries(state.kanji)
    .filter(([, e]) => !e.removed)
    .map(([ch, e]) => ({ id: ch, addedAt: e.addedAt }));
}

/** Add kanji (or bring removed ones back). Returns those that were not in the list before. */
export function enrollKanji(chars) {
  const now = Date.now();
  const added = [];
  chars.forEach((ch) => {
    const entry = state.kanji[ch];
    if (entry && !entry.removed) return;
    state.kanji[ch] = { addedAt: now, removed: false };
    added.push(ch);
  });
  if (added.length) touch();
  return added;
}

/** Hide a kanji from the list; its review scores stay so adding it back restores them. */
export function removeKanji(ch) {
  const entry = state.kanji[ch];
  if (!entry || entry.removed) return;
  entry.removed = true;
  touch();
}

// --- Review scores (words and kanji) ------------------------------------

export function reviewStats(track, id) {
  const entries = state.reviews[track];
  return (entries && entries[id]) || UNSEEN_REVIEW;
}

/** Store one rated answer: the new score, as computed by review.applyRating. */
export function recordReview(track, id, score) {
  if (!state.reviews[track]) state.reviews[track] = {};
  const entry = state.reviews[track][id] || { score: -1, seen: 0, lastSeen: 0 };
  entry.score = score;
  entry.seen += 1;
  entry.lastSeen = Date.now();
  state.reviews[track][id] = entry;
  touch();
}

/** Set a score without counting an answer ("Mark as known", computed by review.knownScore). */
export function setReviewScore(track, id, score) {
  if (!state.reviews[track]) state.reviews[track] = {};
  const entry = state.reviews[track][id] || { score: -1, seen: 0, lastSeen: 0 };
  entry.score = score;
  entry.lastSeen = Date.now();
  state.reviews[track][id] = entry;
  touch();
}

// --- Backup -------------------------------------------------------------

export function exportText() {
  return JSON.stringify(state, null, 1);
}

/** Call once the learner has a backup file: clears the reminder. */
export function markBackedUp() {
  state.settings.lastBackupAt = Date.now();
  state.unsavedSince = 0;
  save();
}

/** {lastBackupAt, unsavedSince, due}: due when changes have waited a week for a backup. */
export function backupStatus(now = Date.now()) {
  const since = state.unsavedSince;
  return {
    lastBackupAt: state.settings.lastBackupAt,
    unsavedSince: since,
    due: Boolean(since) && now - since >= BACKUP_NUDGE_MS
  };
}

/**
 * Replace everything with a backup file's contents. Returns {ok} or {ok: false, error}.
 * Backups from the old Kana SRS app (no `app` field) are refused, not migrated.
 */
export function importText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    console.error('[storage.js][importText] not JSON: ' + err.message);
    return { ok: false, error: 'That file is not a Hino Lite backup.' };
  }
  if (!raw || raw.app !== APP_ID || raw.version !== VERSION) {
    return { ok: false, error: 'That file is not a Hino Lite backup (old Kana SRS backups cannot be loaded).' };
  }
  state = normalize(raw);
  state.unsavedSince = 0;      // what is loaded is exactly what the file holds
  save();
  return { ok: true };
}

/** Erase all learner data; theme and run length stay. The caller has the learner's confirmation. */
export function reset() {
  const { runSize, theme } = state.settings;
  state = blankState();
  state.settings.runSize = runSize;
  state.settings.theme = theme;
  save();
}

/** The whole state, read-only by convention (tests and debugging). */
export function raw() {
  return state;
}
