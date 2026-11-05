# Technical Context — Hino Lite

## Stack

Plain HTML/CSS/JavaScript, native **ES modules** (no bundler, no framework, no dependencies).
Tooling in Python run with `uv` (stdlib only): `tools/build_library.py` builds the kanji library,
`tools/check.py` serves the app and runs the browser tests in headless Chrome/Edge. No Node.

## Architecture

```
data      kana-data            kanji-index (generated)
            ↓                     ↓
rules     kana-srs   romaji → words, sentences, kanji        review (shared rating/run rules)
            ↓                     ↓                              ↓
infra     storage (localStorage)   library (Cache API, one-time download)   sw (app cache)
            ↓
UI        shell · dom · theme · backup
          kana-ui · words-ui · sentences-ui · kanji-ui · kanji-card · review-ui · settings-ui   ← main (boot)
```

Full graph, boundaries and per-module notes: `.agentic_docs/code_index.md`. Rule modules are pure
(tested by `tools/selftest.js` in the browser); UI modules hold no rules.

## Key decisions

- **ES modules, no `file://`.** The kanji library needs the Cache API and a service worker, both
  unavailable on `file://`, so the classic-script constraint of Kana SRS no longer bought anything.
- **No Node.** The rule tests moved from `node tools/selftest.js` to a browser page that imports the
  shipped modules; `check.py` runs it and the UI smoke test headless and collects POSTed reports.
- **One self-rated scheduler for words and kanji** (`review.js`), JLPT_coach's kanji scale: first
  answer from 3, learned 5, confident 15, a miss on a learned card → 4 (a guess only −1), cap 30.
  Scores follow the platform's D56 (−1 = never answered; labels unseen/unknown/learning/learned/
  confident derived in one place). Kana keeps its own timed scoring.
- **Runs**: ≤5 new (newest first, a hard cap — a fresh list gives a 5-card first run), ≤3
  learned/confident sampled by staleness (confident ×0.2), the rest in progress stalest first;
  short runs backfill with known cards only.
- **List progress groups** (`review.progressGroup`, used by the word list): with two directions,
  New only if neither was ever answered, Learned/Confident only when both are, otherwise
  Learning; `isKnown`'s "both learned" bar, so the list and "Mark as known" agree.
- **Reveal plans are rules** (`words.cardPlan`, `kanji.cardPlan`); the shared `review-ui` renders
  any plan through an adapter's part renderers. Example/notes always come last (they contain the word).
- **Storage**: one JSON document in `localStorage` (`hino_lite_v2`) = the backup format (`app:
  'hino_lite'`, `version: 2`); `navigator.storage.persist()` at boot. Kanji list stored explicitly
  (`{addedAt, removed}`) so "nothing leaves automatically" holds after edits; removing hides and
  keeps scores. Old Kana SRS backups are refused. `sentences` was added under v2 as an additive
  collection (`normalize()` defaults it), so no migration and no version bump. Older copies must
  not destroy newer data: `normalize()` keeps unknown keys, and a `storage` event from another tab
  replaces the in-memory copy (whole-document saves would otherwise let a stale tab win).
- **Sentence Parse is a pure rule** (`sentences.js`): bracket readings are attached to the token
  before them by aligning kana (kanji runs as wildcards), which tells a particle (日本語を勉強) from
  okurigana (落ち着いて) without a dictionary; the translation is the Latin/Cyrillic tail. Word
  candidates for the prompt are re-derived from the saved sentence plus Parse's words, so edits
  after Parse are safe. Conjugated forms stay as written; meanings are never prefilled (owner, P13).
- **Kanji library**: 2,099 kanji, example words with frequency rank < 11,000, KanjiVG strokes
  slimmed and recoloured to `currentColor` — 12 files, ~6.7 MB on disk, ~1.7 MB gzipped, in their
  own cache named after a content hash, downloaded on the first Kanji-tab visit (N5 first). A 207 KB
  index (meaning, level, search terms, readings) ships with the app so enrollment works before the
  download.
- **Back button**: `shell` pushes one history entry per focus screen or sheet with a handler, so
  Android's back button walks back instead of closing the app.
- **Japanese text carries `lang="ja"`** and Japanese system fonts first, or kanji render in Chinese
  shapes on non-Japanese phones. Learner text only ever goes in as text.
- **Themes** stay explicit (Dark/Light/Kids), never OS-derived; the Kids theme cheers good ratings.

## Deployment

GitHub Pages from `main` (root) of `hinoproj/hino_lite` → open on the device → *Add to Home
screen*. Bump `CACHE_NAME` in `sw.js` whenever a precached file changes (cache-first never
revalidates; precache fetches use `cache: 'reload'`). A rebuilt library changes `LIBRARY.version`
and downloads again on the next Kanji-tab visit.

## Verification

- `uv run tools/check.py` — selftest (154 checks) + UI smoke (104 checks), must end `ALL CHECKS PASSED`
- `uv run tools/check.py shots OUT` — screenshots at 390×844 and 1280×800 for visual review
- `uv run tools/check.py serve` — local server with correct MIME types
