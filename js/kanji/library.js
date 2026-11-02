// [MODULE] library | Kanji library files: one-time download into the browser cache, then per-level reads (detail, strokes)
// [IFACE] layer: infrastructure | in: kanji characters, a progress callback -> out: level readiness, kanji detail, stroke SVG text | crosses: [network:data/library, Cache Storage API]
// [GRAPH] needs: [kanji-index, kanji] | feeds: [kanji-ui, kanji-card, main] | group: infrastructure
// [STATE] stateful | persists: Cache Storage bucket hino-lite-library-<version> | raises: download() rejects on network or HTTP failure

/**
 * The library is ~6.7 MB on disk (≈1.7 MB over the wire), so it is not part of
 * the app's precache: it downloads the first time the Kanji tab opens, level
 * by level (N5 first), into its own cache named after LIBRARY.version. App
 * updates replace the app cache and leave this one alone; a rebuilt library
 * gets a new version, downloads again, and the old bucket is dropped.
 *
 * Reads go straight to the Cache API rather than through the network, so a
 * level is either fully stored here or reported as not ready.
 */

import { LIBRARY } from './kanji-index.js';
import { indexEntry } from './kanji.js';

export const CACHE_PREFIX = 'hino-lite-library-';
export const CACHE_NAME = CACHE_PREFIX + LIBRARY.version;
export const LEVELS = LIBRARY.levels;
export const TOTAL_BYTES = LIBRARY.levels.reduce((sum, l) => sum + l.bytes, 0);

const APP_ROOT = new URL('../../', import.meta.url);
const memo = { data: new Map(), strokes: new Map() };
let downloading = null;

function urlOf(path) {
  return new URL(path, APP_ROOT).href;
}

export function supported() {
  return typeof caches !== 'undefined';
}

export function isDownloading() {
  return Boolean(downloading);
}

async function levelStored(cache, level) {
  const [data, strokes] = await Promise.all([cache.match(urlOf(level.data)), cache.match(urlOf(level.strokes))]);
  return Boolean(data && strokes);
}

/** The ids of the levels fully stored on this device. */
export async function readyLevels() {
  if (!supported()) return new Set();
  try {
    const cache = await caches.open(CACHE_NAME);
    const ready = new Set();
    for (const level of LEVELS) {
      if (await levelStored(cache, level)) ready.add(level.id);
    }
    return ready;
  } catch (err) {
    console.error('[library.js][readyLevels] cache unavailable: ' + err.message);
    return new Set();
  }
}

/**
 * Download every level that is not stored yet, in order. `onProgress` gets
 * {levelId, bytesDone, bytesTotal} after each level. Resolves to readyLevels();
 * on failure it rejects, and levels already stored stay stored.
 */
export function download(onProgress) {
  if (downloading) return downloading;
  downloading = (async () => {
    const cache = await caches.open(CACHE_NAME);
    let bytesDone = 0;
    for (const level of LEVELS) {
      if (!(await levelStored(cache, level))) {
        for (const path of [level.data, level.strokes]) {
          const response = await fetch(urlOf(path), { cache: 'no-store' });
          if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + path);
          await cache.put(urlOf(path), response);
        }
      }
      bytesDone += level.bytes;
      if (onProgress) onProgress({ levelId: level.id, bytesDone, bytesTotal: TOTAL_BYTES });
    }
    await dropOldVersions();
    return readyLevels();
  })().catch((err) => {
    console.error('[library.js][download] library download stopped: ' + err.message);
    throw err;
  }).finally(() => { downloading = null; });
  return downloading;
}

async function dropOldVersions() {
  const names = await caches.keys();
  await Promise.all(names
    .filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
    .map((n) => caches.delete(n)));
}

function readJson(kind, levelId) {
  const map = memo[kind];
  if (!map.has(levelId)) {
    const level = LEVELS.find((l) => l.id === levelId);
    const promise = (async () => {
      if (!level || !supported()) return null;
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(urlOf(kind === 'data' ? level.data : level.strokes));
      return response ? response.json() : null;
    })().catch((err) => {
      console.error('[library.js][readJson] cannot read ' + kind + ' for ' + levelId + ': ' + err.message);
      return null;
    }).then((value) => {
      if (value === null) map.delete(levelId);   // not stored yet: ask again next time
      return value;
    });
    map.set(levelId, promise);
  }
  return map.get(levelId);
}

/**
 * A kanji's detail from its level file, or null when that level is not stored:
 * {m, alt, on, kun, rad: [[char, meaning]], comp: [[char, meaning]], band,
 *  words: [[word, reading, gloss, rank, pitch[], senses[]]]}
 */
export async function detail(ch) {
  const entry = indexEntry(ch);
  if (!entry) return null;
  const data = await readJson('data', entry.level);
  return (data && data[ch]) || null;
}

/** The kanji's stroke-order SVG markup (generated by the build, trusted), or null. */
export async function strokeSvg(ch) {
  const entry = indexEntry(ch);
  if (!entry) return null;
  const strokes = await readJson('strokes', entry.level);
  return (strokes && strokes[ch]) || null;
}

/** Load several kanji's details at once (a review run needs them all before it starts). */
export async function details(chars) {
  const out = new Map();
  await Promise.all(chars.map(async (ch) => { out.set(ch, await detail(ch)); }));
  return out;
}
