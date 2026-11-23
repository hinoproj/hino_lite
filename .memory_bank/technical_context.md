# Technical Context — Hino Lite

## Stack

Plain HTML/CSS/JavaScript, native **ES modules** (no bundler, no framework, no dependencies).
Tooling in Python run with `uv` (stdlib only): `tools/build_library.py` builds the kanji library,
`tools/check.py` serves the app and runs the browser tests in headless Chrome/Edge. No Node.

## Architecture

```
data      kana-data            kanji-index (generated)
            ↓                     ↓
rules     kana-srs   romaji → words, sentences, kanji        review (shared rating/run/group rules)
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
- **Pitch accent is stored beside the reading, not in it** (P23): `reading` stays plain kana
  (search, duplicate keys, kanji enrollment and the kanji review read it), `accent` holds the
  accented mora's position from 1 (0 flat, null not known). The bracket notation exists only at the
  edges: the gem's pasted line and the form's Reading field (`words.splitAccent` / `formatAccent`).
  Display (`words.accentView` → `dom.jaReading`): the nucleus in bold, a FLAT label for a flat word
  (its tip opens on hover, and on a tap only where nothing else owns the tap, so a review card
  stays one tap target), nothing when not known.
- **Sentence reviews** use the same scheduler, tracks `sentences.read`/`sentences.recall`; only a
  sentence with a translation is reviewed (`sentences.isReviewable`), the others stay in the list.
- **List progress groups** (`review.progressGroup` / `groupByProgress`, used by the word and sentence lists): with two directions,
  New only if neither was ever answered, Learned/Confident only when both are, otherwise
  Learning; `isKnown`'s "both learned" bar, so the list and "Mark as known" agree. Above them
  sits **Least known** (`review.leastKnown`, P28): a copy of the items unknown (0–1) in either
  direction, longest unknown first (the run's tier-1 order); search filters it like the rest.
- **Least known: Copy and Quiz** (P29, words only): Copy → `words.copyText` on the clipboard. The quiz
  is rules in `review/quiz.js` (run, score, options) + `words.quizPlan`/`quizPools`/`kanaFit` (options
  whose kana fit the prompt first, P30), screens in
  `review/quiz-ui.js` (`#screen-quiz`, `#screen-quiz-summary`); it scores into the same tracks as the
  self-rated review but through `storage.setQuizScore`: the score (and `unknownSince` when a word leaves
  unknown) only, never `seen` or `lastSeen`, so the quiz moves a word's state but not run order (owner).
  Undo is `storage.restoreReview` with the entry copied before the answer. Before the last step a pick
  holds 0.5 s and the next step follows by itself; the last step waits for Next word (P30).
- **Redraw through `dom.fill`** (contract 13): the native `replaceChildren` prints a `null` child as
  "null"; `fill` applies `h()`'s child rules (flatten, skip null/false).
- **Reveal plans are rules** (`words.cardPlan`, `kanji.cardPlan`); the shared `review-ui` renders
  any plan through an adapter's part renderers. Notes, then the example, always come last (they contain the word).
  An adapter may lay parts out from the plan (the kanji adapter puts stroke order beside the glyph when
  the plan reveals both in one step), but never decides what is revealed when. A review card is one
  tap target: nothing on it is a button, so anything the learner would otherwise open is shown in full.
  Once fully revealed (`.done`) it may be resized but never cut: on a phone the ratings are pinned
  to the bottom edge, and a long word meaning steps down a font size instead of being truncated.
  Beside its prompt the card shows its score as dots (P27; columns sized by `LEARNED_AT` and
  `CONFIDENT_AT`), read once when the card renders: a rating never re-renders them (contract 9).
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
- **Pasted blocks are split by line position** (`words.parsePaste`, `sentences.parsePaste`, P20),
  matching the owner's AI chat gem's output format; a sentence's first line goes through the
  unchanged `readAnnotations`. The receiving fields (word Kanji, Sentence) are one-line textareas
  (`dom.pasteBlockField`): an `<input>` strips pasted line breaks, and detection runs on `input`
  rather than `paste` because a phone keyboard's clipboard strip fires no paste event. A typed Enter
  moves to the next field, so any line break in the value came from a paste.
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

- `uv run tools/check.py` — selftest (181 checks) + UI smoke (152 checks), must end `ALL CHECKS PASSED`
- `uv run tools/check.py shots OUT` — screenshots at 390×844 and 1280×800 for visual review
- `uv run tools/check.py serve` — local server with correct MIME types
