# Code Index — Hino Lite

Project-wide module graph. Authoritative for module slugs, dependency edges, `crosses:`
boundaries and `group:` values: on any conflict with an `AGENTS.md`, this file wins.

## Dependency Graph

| Module | File | Layer | needs | feeds | group | crosses |
| --- | --- | --- | --- | --- | --- | --- |
| kana-data | js/kana/kana-data.js | data | — | kana-srs, kana-ui, main, selftest | data | — |
| kanji-index | js/kanji/kanji-index.js | data | — | kanji, library, selftest | data | — |
| romaji | js/core/romaji.js | domain | — | words, words-ui, sentences, sentences-ui, kanji, selftest | domain | — |
| kana-srs | js/kana/kana-srs.js | domain | kana-data | kana-ui, selftest | domain | — |
| review | js/review/review.js | domain | — | review-ui, words-ui, kanji-ui, kanji-card, selftest | domain | — |
| words | js/words/words.js | domain | romaji | words-ui, sentences-ui, kanji-card, kanji-ui, selftest | domain | — |
| sentences | js/sentences/sentences.js | domain | romaji | sentences-ui, selftest | domain | — |
| kanji | js/kanji/kanji.js | domain | kanji-index, romaji | kanji-ui, kanji-card, words-ui, sentences-ui, library, selftest | domain | — |
| storage | js/core/storage.js | infrastructure | — | main, theme, backup, shell, kana-ui, words-ui, sentences-ui, review-ui, kanji-ui, kanji-card, settings-ui, selftest | infrastructure | browser localStorage, StorageManager |
| library | js/kanji/library.js | infrastructure | kanji-index, kanji | kanji-ui, kanji-card, main | infrastructure | network:data/library, Cache Storage API |
| sw | sw.js | infrastructure | — | main | infrastructure | Cache Storage API |
| dom | js/core/dom.js | presentation | — | shell, kana-ui, words-ui, sentences-ui, review-ui, kanji-ui, kanji-card, settings-ui | presentation | browser DOM |
| theme | js/core/theme.js | presentation | storage | main, kana-ui, review-ui, settings-ui | presentation | browser DOM |
| backup | js/core/backup.js | presentation | storage | shell, settings-ui | presentation | browser downloads, FileReader |
| shell | js/core/shell.js | presentation | dom, storage, backup | main, kana-ui, words-ui, sentences-ui, review-ui, kanji-ui, kanji-card, settings-ui | presentation | browser DOM, History API |
| kana-ui | js/kana/kana-ui.js | presentation | kana-data, kana-srs, storage, theme, shell, dom | main | presentation | browser DOM |
| review-ui | js/review/review-ui.js | presentation | review, storage, theme, shell, dom | words-ui, kanji-ui, kanji-card | presentation | browser DOM |
| words-ui | js/words/words-ui.js | presentation | words, romaji, kanji, review, review-ui, storage, shell, dom, kanji-card | main, kanji-card | presentation | browser DOM |
| sentences-ui | js/sentences/sentences-ui.js | presentation | sentences, words, kanji, romaji, storage, shell, dom | main, kanji-card | presentation | browser DOM |
| kanji-card | js/kanji/kanji-card.js | presentation | kanji, library, words, review, review-ui, storage, shell, dom, words-ui, sentences-ui | kanji-ui, words-ui | presentation | browser DOM |
| kanji-ui | js/kanji/kanji-ui.js | presentation | kanji, library, review, review-ui, words, storage, shell, dom, kanji-card | main | presentation | browser DOM |
| settings-ui | js/settings/settings-ui.js | presentation | storage, theme, backup, shell, dom | main | presentation | browser DOM |
| main | js/main.js | presentation | storage, theme, shell, kana-ui, words-ui, sentences-ui, kanji-ui, settings-ui, kana-data, library, sw | index | presentation | browser DOM, service worker |
| app-css | css/app.css | presentation | — | index | presentation | — |
| review-css | css/review.css | presentation | — | index | presentation | — |
| words-css | css/words.css | presentation | — | index | presentation | — |
| sentences-css | css/sentences.css | presentation | — | index | presentation | — |
| kanji-css | css/kanji.css | presentation | — | index | presentation | — |
| index | index.html | presentation | app-css, review-css, words-css, sentences-css, kanji-css, main | browser-smoke, scene | presentation | browser DOM |
| build-library | tools/build_library.py | tooling | — | — | tooling | filesystem |
| check | tools/check.py | tooling | selftest-page, browser-smoke-page, scene | — | tooling | filesystem, local HTTP server, Chrome process |
| selftest-page | tools/selftest.html | tooling | selftest | check | tooling | browser DOM |
| selftest | tools/selftest.js | tooling | kana-data, kana-srs, romaji, review, words, sentences, kanji, kanji-index, storage | selftest-page | tooling | browser DOM, local HTTP server |
| browser-smoke-page | tools/browser-smoke.html | tooling | browser-smoke | check | tooling | browser DOM |
| browser-smoke | tools/browser-smoke.js | tooling | index | browser-smoke-page | tooling | browser DOM, localStorage, Cache Storage API, local HTTP server |
| scene | tools/scene.html | tooling | index | check | tooling | browser DOM, localStorage |

`words-ui` ↔ `kanji-card` is a deliberate import cycle (the word sheet opens kanji cards; a card
opens the word form and word sheet). Both sides only call each other's functions at run time, which
ES modules allow. `build-library` *generates* `kanji-index` and `data/library/*` rather than being
imported, so the edge is recorded here and in the Cross-cutting table of `AGENTS.md`, not in `needs`.

## External Boundary Map

| Boundary | Modules | Direction | Notes |
| --- | --- | --- | --- |
| browser localStorage | storage, browser-smoke | read/write | Only `storage` reads/writes app data (key `hino_lite_v2`); every access guarded; other tabs' saves arrive as `storage` events and replace the in-memory copy. The smoke test clears the key first and writes it once as "another tab". |
| StorageManager | storage | write | `navigator.storage.persist()` at boot asks the browser not to evict the data. |
| network:data/library | library | in | The 12 level files (data + strokes per level), fetched once with `cache: 'no-store'`. |
| Cache Storage API | sw, library, browser-smoke | read/write | `sw` owns `hino-lite-app-v*`; `library` owns `hino-lite-library-<version>`. `sw` never deletes library buckets. |
| browser DOM | dom, theme, shell, kana-ui, review-ui, words-ui, sentences-ui, kanji-card, kanji-ui, settings-ui, main, index, selftest-page, selftest, browser-smoke-page, browser-smoke, scene | read/write | Learner text only through `textContent`; `html:` only for generated SVG. |
| History API | shell | read/write | One history entry per focus screen or open sheet, so Android's back button walks back. |
| browser downloads, FileReader | backup | out / in | Backup export (a `.json` download) and import. |
| service worker | main | out | Registration only. |
| filesystem | build-library, check | read/write | `build-library` reads `../data` and writes the generated library; `check shots` writes PNGs. |
| local HTTP server | check, selftest, browser-smoke | in / out | `check` serves the repo with correct MIME types; test pages POST their reports to `/__report`; `/__delay` holds a page's load for screenshots. |
| Chrome process | check | out | Headless Chrome/Edge with a throwaway profile. |

## Group Registry

| Group | Meaning | Members |
| --- | --- | --- |
| data | Static tables with no behaviour (one generated) | kana-data, kanji-index |
| domain | Pure rules: no DOM, no storage, no network | romaji, kana-srs, review, words, sentences, kanji |
| infrastructure | Owns a browser/platform storage or network API | storage, library, sw |
| presentation | Screens, markup, styling, event handling | dom, theme, backup, shell, kana-ui, review-ui, words-ui, sentences-ui, kanji-card, kanji-ui, settings-ui, main, app-css, review-css, words-css, sentences-css, kanji-css, index |
| tooling | Developer-only builds and checks, never in the app's load path | build-library, check, selftest-page, selftest, browser-smoke-page, browser-smoke, scene |

---

## kana-data

**File**: `js/kana/kana-data.js` · **Layer**: data

Six decks: hiragana/katakana × basic (46) / dakuten+handakuten (25) / yōon (36) = 214 kana. Item
order within a deck **is** the introduction order (gojūon rows). Katakana decks are generated from
the hiragana tables plus a glyph string. `pr` differs from `r` only for the ぢ/づ homophones.
`confusionWeight(a, b)`: `SHAPE_WEIGHT` (4) for a listed look-alike (base glyphs), +2 shared
consonant, +1 shared vowel.

**Exposes**: `KANA_DATA` {`decks`, `deckById`, `byKey`, `SHAPE_WEIGHT`, `confusionWeight`, `baseGlyph`}

## kanji-index

**File**: `js/kanji/kanji-index.js` · **Layer**: data · **Generated** by `build-library`

`LIBRARY` = {`version` (hash of the level files; names the library cache), `levels`: [{id, label,
count, data, strokes, bytes}] for N5, N4, N3, N2, N1, none}. `KANJI_INDEX` = kanji → [meaning,
level, extra search terms joined by `|` (alternative meanings + glosses of the word that is the
kanji itself), on+kun readings joined by space]; key order = level, then integral rank
(`difficulty + frequency band + 100/n_words`). Always shipped (207 KB), so a saved word can join
the kanji list before the library is downloaded.

**Exposes**: `LIBRARY`, `KANJI_INDEX`

## romaji

**File**: `js/core/romaji.js` · **Layer**: domain

IME-style rōmaji → kana: longest match, doubled consonant / `tch` → っ, `n` before a consonant or at
the end → ん, `n'` → ん, `nn` + vowel/y → ん + な/にゃ-row (Hepburn: konnichiha, konnyaku), `-` → ー, `, . ! ? ~` → `、 。 ！ ？ 〜` with the spaces around them dropped.
Unmatched letters stay Latin so `hasLatin` can flag an impossible reading.

**Exposes**: `toHiragana`, `toKatakana`, `hiraganaToKatakana`, `katakanaToHiragana`, `hasLatin`, `isKana`

## kana-srs

**File**: `js/kana/kana-srs.js` · **Layer**: domain

Timed point scoring (MCQ +5/+3/+1, typed +3, wrong −5, floor 0), states (learned 10, confident
25), per kana **per mode**; run composition (earliest not-learned in row order, ≤3 learned + ≤1
confident); question building with look-alike distractors, homophone guard and mistake replay
(`pushMiss`, `MISS_LIMIT` 3). Unchanged from Kana SRS apart from the module wrapper.

**Exposes**: `KanaSRS` {`MODES`, `MODE_INFO`, `MODE_*`, `FAST_MS`, `OK_MS`, `LEARNED_AT`,
`CONFIDENT_AT`, `RUN_SIZES`, `OPTION_COUNT`, `MISS_LIMIT`, `STATE_*`, `modesForDeck`, `stateOf`,
`pointsFor`, `applyPoints`, `pushMiss`, `buildRun`, `buildQuestion`, `checkTyped`, `shuffle`}

## review

**File**: `js/review/review.js` · **Layer**: domain

One scheduler for every self-rated review (words and kanji), on JLPT_coach's kanji scale: ratings
Didn't know −3 / Guessed −1 / Knew it +1 / Easy! +2; an unseen card's first answer starts from
`INITIAL_SCORE` 3; a miss on a learned card drops it to `DEMOTION_SCORE` 4 (a guess only erodes by
1); scores 0–30. Labels per D56: unseen −1, unknown 0, learning 1–4, learned 5–14, confident 15+.
`buildRun`: ≤`MAX_NEW_PER_RUN` (5, hard cap) unseen newest first, ≤`MAX_MAINTENANCE_PER_RUN` (3)
learned/confident sampled by staleness (`(1 + days, cap 30) × 0.2 if confident`), the rest in
progress stalest first; short runs backfill with known cards only; shuffled.

**Exposes**: `UNSEEN`, `SCORE_MIN`, `SCORE_MAX`, `INITIAL_SCORE`, `LEARNED_AT`, `CONFIDENT_AT`,
`DEMOTION_SCORE`, `RATING_*`, `RATINGS`, `STATE_*`, `STATES`, `RUN_SIZES`, `MAX_NEW_PER_RUN`,
`MAX_MAINTENANCE_PER_RUN`, `STALE_CAP_DAYS`, `CONFIDENT_FACTOR`, `stateOf`, `isRating`,
`applyRating`, `knownScore`, `isKnown`, `shuffle`, `maintenanceWeight`, `buildRun`, `countStates`

## words

**File**: `js/words/words.js` · **Layer**: domain

Word rules. `normalizeDraft` trims and converts leftover rōmaji in the reading to hiragana;
`validate` requires a kana-only reading and a meaning; `duplicateKey` = writing|reading;
`extractKanji` = library kanji in the writing, in order, once, 々 skipped. `cardPlan(word, track)`:
Japanese → meaning = writing | reading | meaning+example+notes (no writing: reading | meaning…);
Meaning → Japanese = meaning | reading | writing+example+notes (no writing: meaning | reading…);
empty extras dropped. `matchesQuery` searches every field, and rōmaji/katakana queries match the reading.

**Exposes**: `TRACK_READ`, `TRACK_RECALL`, `TRACKS`, `TRACK_INFO`, `FIELDS`, `FIELD_LABELS`,
`normalizeDraft`, `validate`, `duplicateKey`, `extractKanji`, `headline`, `cardPlan`, `matchesQuery`, `sortForList`

## sentences

**File**: `js/sentences/sentences.js` · **Layer**: domain

Sentence rules (P13). `splitTranslation`: the Latin/Cyrillic tail after the last Japanese letter
(closing `。）` etc. stay Japanese; a leading `— - : |` delimiter and wrapping brackets dropped).
`readAnnotations`: `()`, `（）`, `[]`, `［］` holding kana are readings; the token since the previous
bracket loses its leading non-kanji except お/ご, and when it holds several kanji runs the earliest
start whose kana align with the reading wins (日本語を勉強（べんきょう） → 勉強; 落ち着いて stays whole);
a bracket after a kana-only token is dropped, one without kana stays as text; the sentence reading
is filled only when no kanji or Latin is left. `parse` = both; `canParse` = Parse would change
something. `candidates(sentence, known)`: known/bracketed words where they occur, then every other
kanji run (with a preceding お/ご) with an empty reading, in order, each once; kana-only words never.
`exampleFor` = sentence + newline + translation. Reading optional, rōmaji → hiragana, no kanji or
Latin. Conjugated forms stay as written; their dictionary form goes in the meaning, by hand.

**Exposes**: `FIELDS`, `FIELD_LABELS`, `splitTranslation`, `readAnnotations`, `parse`, `canParse`,
`candidates`, `exampleFor`, `normalizeDraft`, `validate`, `matchesQuery`, `sortForList`

## kanji

**File**: `js/kanji/kanji.js` · **Layer**: domain

Library membership and order from `kanji-index`; search (kanji in the query → membership; kana →
reading contains; Latin → meaning word-prefix, or the query as kana prefixes a reading);
`cardPlan(track)`: Kanji → meaning = glyph | meaning | readings, strokes, your words; Meaning →
kanji = meaning | glyph | readings, strokes, your words. `wordsUsing` / `sentencesUsing`: the
learner's words (writing) and sentences (sentence text only) that contain a kanji.

**Exposes**: `TRACK_READ`, `TRACK_RECALL`, `TRACKS`, `TRACK_INFO`, `LEVELS`, `isLibraryKanji`,
`indexEntry`, `compareKanji`, `allKanji`, `matchesQuery`, `cardPlan`, `wordsUsing`, `sentencesUsing`

## storage

**File**: `js/core/storage.js` · **Layer**: infrastructure

The only `localStorage` user; key `hino_lite_v2`, which is also the backup format
`{app: 'hino_lite', version: 2, updatedAt, unsavedSince, settings{runSize, theme, lastBackupAt},
kana, words, sentences, kanji{addedAt, removed}, reviews{track: {id: {score, seen, lastSeen}}}}`.
`sentences` (`{id, sentence, reading, translation, notes, createdAt, updatedAt}`) is additive under
v2: `normalize` defaults it to `{}`, so older v2 data and backups load unchanged. Deleting a sentence
leaves the words made from it. Older copies never destroy newer data: `normalize` keeps unknown keys
(top level, settings, each word and sentence) as they are, and `load` starts listening for the
`storage` event, so another tab's save replaces this tab's copy instead of being overwritten by it. A missing
review entry means unseen (−1). Removing a kanji keeps its review entries; deleting a word drops
its own. `normalize` rebuilds any untrusted JSON; `importText` refuses files without
`app: 'hino_lite'`, v2 (old Kana SRS backups). `backupStatus().due` after 7 days of unsaved changes.
Stores values computed by the rule modules and applies no rule itself.

**Exposes**: `STORAGE_KEY`, `APP_ID`, `VERSION`, `THEMES`, `BACKUP_NUDGE_MS`, `normalize`, `load`,
`save`, `isAvailable`, `requestPersistence`, `isPersisted`, `getSettings`, `setRunSize`, `setTheme`,
`kanaStats`, `recordKana`, `listWords`, `getWord`, `saveWord`, `deleteWord`, `listSentences`,
`getSentence`, `saveSentence`, `deleteSentence`, `kanjiEntry`,
`isEnrolled`, `listKanji`, `enrollKanji`, `removeKanji`, `reviewStats`, `recordReview`,
`setReviewScore`, `exportText`, `markBackedUp`, `backupStatus`, `importText`, `reset`, `raw`

## library

**File**: `js/kanji/library.js` · **Layer**: infrastructure

Downloads the 12 level files (N5 first) into `hino-lite-library-<LIBRARY.version>` on the first
Kanji-tab visit and drops older versions; reads go straight to that cache, memoised per level, so
a level is either fully stored or reported missing. Detail shape: `{m, alt, on, kun, rad, comp,
band, words: [[word, reading, gloss, rank, pitch[], senses[]]]}`.

**Exposes**: `CACHE_PREFIX`, `CACHE_NAME`, `LEVELS`, `TOTAL_BYTES`, `supported`, `isDownloading`,
`readyLevels`, `download`, `detail`, `strokeSvg`, `details`

## sw

**File**: `sw.js` · **Layer**: infrastructure

Cache-first precache of `ASSETS` into `CACHE_NAME` (`hino-lite-app-v3`), fetched with
`cache: 'reload'`; activation deletes every other bucket except `hino-lite-library-*`. Serves
library files from their cache too. Bump `CACHE_NAME` on every release.

## dom

**File**: `js/core/dom.js` · **Layer**: presentation

`h()` element builder (text as text, `html:` for trusted markup), `ja()` for Japanese spans,
`button`, `segmented`, `toast`, `formatDaysAgo`, and `confirmAction`/`notify` — the single seams the
smoke test answers.

**Exposes**: `$`, `h`, `ja`, `button`, `segmented`, `confirmAction`, `notify`, `toast`, `formatDaysAgo`

## theme

**File**: `js/core/theme.js` · **Layer**: presentation

Stamps `data-theme` on `<html>` and the Android status-bar colour; holds the Kids theme's cheers.

**Exposes**: `THEME_BAR_COLOR`, `isKids`, `applyTheme`, `cheer`, `missLine`, `summaryCheer`

## backup

**File**: `js/core/backup.js` · **Layer**: presentation

`exportBackup` downloads `hino-lite-backup-YYYY-MM-DD.json` and marks the backup time;
`importBackupFile` reads a chosen file and hands it to `storage.importText`.

**Exposes**: `exportBackup`, `importBackupFile`

## shell

**File**: `js/core/shell.js` · **Layer**: presentation

Tab registry and `showScreen` (tab screens carry `data-tab` and show the tab bar; focus screens
hide it); the back stack (`enterBack` pushes a history entry with a handler, `swapBack` replaces
it, `leave` = Android back); the sheet overlay (`openSheet` replaces content, one history entry);
the backup reminder banner.

**Exposes**: `TABS`, `registerTab`, `activeTab`, `goTab`, `showScreen`, `enterBack`, `swapBack`,
`leave`, `openSheet`, `sheetOpen`, `closeSheet`, `closeSheetNow`, `bindShell`

## kana-ui

**File**: `js/kana/kana-ui.js` · **Layer**: presentation

The kana drill's screens (decks, modes, timed run with the timer ring, summary), unchanged in
behaviour; navigation goes through the shell's back stack.

**Exposes**: `initKana`, `renderKanaHome`, `meterHtml`

## review-ui

**File**: `js/review/review-ui.js` · **Layer**: presentation

The self-rated run shared by words and kanji: an adapter gives the run, `plan(item)` and
`renderPart(item, key, asPrompt)`; the main button / card tap reveals the next step, "Show all"
reveals the rest, then four rating buttons and the "Which one do I press?" help (no points). Kids
theme cheers a good rating. Summary: counts per rating, newly learned, per-item rows, "Run again"
(accepts a promise). Also the `trackPanel` (run length + one row per track) and `stateDots` used
by both tabs, and `trackRow` (a direction's name, state and four steps lit up to the state, no
points) that the word sheet and the kanji card build their progress panels from.

**Exposes**: `startReview`, `trackPanel`, `meter`, `stateDots`, `trackRow`

## words-ui

**File**: `js/words/words-ui.js` · **Layer**: presentation

Words tab (review panel, search, list), word sheet (hero: the word and its reading with a
progress panel — both directions as lit steps and "Mark as known" until both are learned —
under them on a phone, beside them from 720 px; then meaning, example, notes and kanji chips as
hairline rows, two columns from 720 px; Edit/Delete on the right),
add/edit form (rōmaji suggestions as hiragana/katakana chips, live "Adds to your kanji" preview,
duplicate refusal with "Open it"), save → `storage.saveWord` + `enrollKanji`; the word review adapter.

**Exposes**: `renderWords`, `openWordView`, `openWordForm`

## sentences-ui

**File**: `js/sentences/sentences-ui.js` · **Layer**: presentation

Sentences tab (search, list newest first), sentence sheet (reading, translation, notes, Edit,
Delete — words made from it stay), add/edit form (Parse button while `canParse`, Undo restores
the pasted text, rōmaji reading preview). Saving a **new** sentence with kanji opens the word-card
prompt (replaces the form's back entry): one row per candidate with editable kanji and reading and
an empty meaning; Add is enabled once meaning and reading are filled, saves the word with the
sentence as its example and enrolls its kanji; a word already in the list (writing|reading) is only
marked. Edits never prompt. The sentence sheet also opens from a kanji card's "In your sentences".

**Exposes**: `renderSentences`, `openSentenceView`

## kanji-card

**File**: `js/kanji/kanji-card.js` · **Layer**: presentation

Kanji card in the sheet, ported from JLPT_coach's. Hero: glyph, level, meaning + also, and a
progress panel (per track a `review-ui.trackRow`: name, state, four steps lit up to the state —
never points; Add / Remove / Mark as known, hidden once `review.isKnown`); on a phone the panel drops under the glyph. Then stroke order beside the
readings panel (readings, radicals, linkable components; stacked on a phone), "In your words" and
"In your sentences" (kanji marked; 3 + show all; opens the sentence sheet), example words (8 + show
all) → word sub-view with pitch-accent diagrams and "+ Add to my words" (opens the prefilled form)
or "In your words ✓". Own view stack with ←; the learner's words and sentences open their own
sheets in place of the card.

**Exposes**: `openKanjiCard`, `readingsNode`, `pitchSvg`

## kanji-ui

**File**: `js/kanji/kanji-ui.js` · **Layer**: presentation

Kanji tab: starts the one-time download on first open (progress, retry, offline message), review
panel (enabled once the enrolled kanji's levels are stored), Mine/All, level chips, search, level
sections of tiles with state dots; the kanji review adapter (preloads details and strokes).

**Exposes**: `renderKanji`

## settings-ui

**File**: `js/settings/settings-ui.js` · **Layer**: presentation

Theme picker, backup status + export/import (confirmed), storage/persistence status, reset (two
confirmations; theme and run length kept).

**Exposes**: `initSettings`, `renderSettings`

## main

**File**: `js/main.js` · **Layer**: presentation

Boot: load storage, theme, shell, the five tabs; route `#kana`, `#words`, `#sentences`, `#kanji`, `#kanji/<kanji>`,
`#settings`; request persistent storage; register `sw.js`; expose `window.HinoLite` {store,
KANA_DATA, library} for tests and debugging.

## app-css, review-css, words-css, sentences-css, kanji-css

**Files**: `css/app.css` (themes, state colours, shell: tab bar, sheet, banner, toast; shared
controls; kana screens), `css/review.css` (track panel, the cards' progress panel and step rows,
review card, ratings, help, summary), `css/words.css` (list, form, word sheet with its hero row;
its `.field*` classes serve the sentence form too; the word sheet's field grid),
`css/sentences.css` (sentence list, form and Parse bar, sheet, word-card prompt rows), `css/kanji.css` (library, tiles, card hero with the
progress panel's placement, card zones (square outlines; only strokes filled; examples with a left rule only), strokes, readings with parts, your sentences, pitch; phone layout below 600 px). Themes are explicit (`data-theme`), never OS-derived.

## index

**File**: `index.html` · **Layer**: presentation

Static kana screens and Settings, empty containers for the words/sentences/kanji/review screens,
the sheet layer, the backup banner and the five-button tab bar; loads the five stylesheets and
`js/main.js` as a module.

## build-library

**File**: `tools/build_library.py` · **Layer**: tooling

`uv run tools/build_library.py [--data ../data]`. Reads the platform repo's `kanji_library.json`,
the per-level vocabulary shards (words with frequency rank < 11,000) and the stroke SVGs (slimmed,
stroke colour → `currentColor`); writes `data/library/<level>.json` + `.strokes.json` and
`js/kanji/kanji-index.js`.

## check

**File**: `tools/check.py` · **Layer**: tooling

`uv run tools/check.py [all|selftest|smoke|serve|shots OUT]`. Serves the repo, runs the test pages
in headless Chrome/Edge (throwaway profile), collects their POSTed reports; `serve` is the dev
server; `shots` screenshots `scene.html` scenes (including the word sheet) at 390×844 and 1280×800.

## selftest-page, selftest

**Files**: `tools/selftest.html`, `tools/selftest.js` · **Layer**: tooling

Imports the shipped rule modules as they are and asserts kana tables/rules, rōmaji conversion,
review scoring and run composition, word, sentence (Parse, candidates) and kanji rules, storage
normalisation.

## browser-smoke-page, browser-smoke

**Files**: `tools/browser-smoke.html`, `tools/browser-smoke.js` · **Layer**: tooling

Drives the real app in an iframe: kana runs and themes, word add/validate/duplicate/edit/search,
both word reviews and the rating help, library download, Mine/All/levels/search, kanji card
(progress panel, parts in the readings panel, components, example words, add to my words),
remove / add / mark as known, kanji review, backup
round trip and reminder, sentences (Parse/Undo, word-card prompt with readings, already-in-list,
plain sentence with a rōmaji reading, search, a kanji card listing and opening its sentences, edit
without prompt, backup, delete keeps words),
another tab's save taken over and newer-version keys kept, Android back, service worker install.

## scene

**File**: `tools/scene.html` · **Layer**: tooling

Seeds sample data and drives the app (iframe sized to the requested width) to one screen for
`check.py shots`; holds its load event on `/__delay` so the screenshot waits for real work.
