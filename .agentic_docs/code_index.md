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
| review | js/review/review.js | domain | — | review-ui, quiz, quiz-ui, words-ui, sentences-ui, kanji-ui, kanji-card, selftest | domain | — |
| quiz | js/review/quiz.js | domain | review | quiz-ui, words-ui, selftest | domain | — |
| words | js/words/words.js | domain | romaji | words-ui, sentences-ui, kanji-card, kanji-ui, selftest | domain | — |
| sentences | js/sentences/sentences.js | domain | romaji | sentences-ui, selftest | domain | — |
| kanji | js/kanji/kanji.js | domain | kanji-index, romaji | kanji-ui, kanji-card, words-ui, sentences-ui, library, selftest | domain | — |
| storage | js/core/storage.js | infrastructure | — | main, theme, backup, shell, kana-ui, words-ui, sentences-ui, review-ui, quiz-ui, kanji-ui, kanji-card, settings-ui, selftest | infrastructure | browser localStorage, StorageManager |
| library | js/kanji/library.js | infrastructure | kanji-index, kanji | kanji-ui, kanji-card, main | infrastructure | network:data/library, Cache Storage API |
| sw | sw.js | infrastructure | — | main | infrastructure | Cache Storage API |
| dom | js/core/dom.js | presentation | — | shell, kana-ui, words-ui, sentences-ui, review-ui, quiz-ui, kanji-ui, kanji-card, settings-ui | presentation | browser DOM |
| theme | js/core/theme.js | presentation | storage | main, kana-ui, review-ui, settings-ui | presentation | browser DOM |
| backup | js/core/backup.js | presentation | storage | shell, settings-ui | presentation | browser downloads, FileReader |
| shell | js/core/shell.js | presentation | dom, storage, backup | main, kana-ui, words-ui, sentences-ui, review-ui, quiz-ui, kanji-ui, kanji-card, settings-ui | presentation | browser DOM, History API |
| kana-ui | js/kana/kana-ui.js | presentation | kana-data, kana-srs, storage, theme, shell, dom | main | presentation | browser DOM |
| review-ui | js/review/review-ui.js | presentation | review, storage, theme, shell, dom | words-ui, sentences-ui, kanji-ui, kanji-card | presentation | browser DOM |
| quiz-ui | js/review/quiz-ui.js | presentation | quiz, review, storage, shell, dom | words-ui | presentation | browser DOM |
| words-ui | js/words/words-ui.js | presentation | words, romaji, kanji, review, review-ui, quiz, quiz-ui, storage, shell, dom, kanji-card | main, kanji-card | presentation | browser DOM |
| sentences-ui | js/sentences/sentences-ui.js | presentation | sentences, words, kanji, romaji, review, review-ui, storage, shell, dom | main, kanji-card | presentation | browser DOM |
| kanji-card | js/kanji/kanji-card.js | presentation | kanji, library, words, review, review-ui, storage, shell, dom, words-ui, sentences-ui | kanji-ui, words-ui | presentation | browser DOM |
| kanji-ui | js/kanji/kanji-ui.js | presentation | kanji, words, library, review, review-ui, storage, shell, dom, kanji-card | main | presentation | browser DOM |
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
| selftest | tools/selftest.js | tooling | kana-data, kana-srs, romaji, review, quiz, words, sentences, kanji, kanji-index, storage | selftest-page | tooling | browser DOM, local HTTP server |
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
| browser DOM | dom, theme, shell, kana-ui, review-ui, quiz-ui, words-ui, sentences-ui, kanji-card, kanji-ui, settings-ui, main, index, selftest-page, selftest, browser-smoke-page, browser-smoke, scene | read/write | Learner text only through `textContent`; `html:` only for generated SVG. |
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
| domain | Pure rules: no DOM, no storage, no network | romaji, kana-srs, review, quiz, words, sentences, kanji |
| infrastructure | Owns a browser/platform storage or network API | storage, library, sw |
| presentation | Screens, markup, styling, event handling | dom, theme, backup, shell, kana-ui, review-ui, quiz-ui, words-ui, sentences-ui, kanji-card, kanji-ui, settings-ui, main, app-css, review-css, words-css, sentences-css, kanji-css, index |
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

One scheduler for every self-rated review (words, kanji, sentences), on JLPT_coach's kanji scale: ratings
Didn't know −3 / Guessed −1 / Knew it +2 / Easy! +4; an unseen card's first answer starts from
`INITIAL_SCORE` 4 (a first "Easy!" is 8, learned; "Knew it" 6); a miss on a learned card drops it to `DEMOTION_SCORE`
5 (`LEARNED_AT − 2`), so a second miss in a row pays points (a guess only erodes by 1); scores 0–30. Labels (D56's shape, Hino Lite's thresholds, P26): unseen −1, unknown 0–1, learning
2–6, learned 7–13, confident 14+. `buildRun` (P26) fills strict tiers: unknown (oldest `unknownSince`
first, never rested; `lastSeen` stands in for older stats), learning (stalest first), then the room
left goes to new cards (newest first) and learned/confident ones (sampled by staleness:
`(1 + days, cap 30) × 0.2 if confident`) in turns — `NEW_FIRST` 5 new, `RECHECK_FIRST` 3 known,
more new up to `MAX_NEW_TOTAL` 10 (hard cap), then known; each step is a pool and a cumulative cap;
shuffled. `progressGroup`
(P18): an item reviewed in several directions is New only if never answered in any, Learned /
Confident only when every direction is, otherwise Learning; `PROGRESS_GROUPS` lists them least
known first; `groupByProgress(items, scoresOf)` splits a list into them, empty groups left out.
`leastKnown(items, statsOf)` (P28) picks the items unknown in any direction, longest unknown
first (`unknownSince`, else `lastSeen`) — the list's `LEAST_KNOWN` copy group, shown above the
progress groups; the items stay in their own group too.

**Exposes**: `UNSEEN`, `SCORE_MIN`, `SCORE_MAX`, `INITIAL_SCORE`, `LEARNING_AT`, `LEARNED_AT`, `CONFIDENT_AT`,
`DEMOTION_SCORE`, `RATING_*`, `RATINGS`, `STATE_*`, `STATES`, `RUN_SIZES`, `NEW_FIRST`, `RECHECK_FIRST`, `MAX_NEW_TOTAL`,
`STALE_CAP_DAYS`, `CONFIDENT_FACTOR`, `stateOf`, `isUnknown`, `isRating`,
`applyRating`, `knownScore`, `isKnown`, `PROGRESS_GROUPS`, `progressGroup`, `groupByProgress`, `LEAST_KNOWN`, `leastKnown`, `shuffle`, `maintenanceWeight`, `buildRun`, `countStates`

## quiz

**File**: `js/review/quiz.js` · **Layer**: domain

The multiple-choice quiz of least-known items (P29). `quizRun(items, statsOf, size)`: the items
unknown in one direction (`review.leastKnown` on that track), longest unknown first, up to `size`,
shuffled. `quizScore(score, rightSteps)`: showing an item costs `SHOW_COST` 1, each right step earns
`STEP_POINTS` 1 (two steps: +1 / 0 / −1; one step: 0 / −1), floor 0. `promoted(before, after)`: out of
unknown. `pickOptions(answer, pools)`: the answer and up to `OPTION_COUNT` − 1 other texts drawn at
random from the pools in order (least known, learning, the rest), empty and repeated texts skipped,
shuffled.

**Exposes**: `OPTION_COUNT`, `SHOW_COST`, `STEP_POINTS`, `quizRun`, `quizScore`, `promoted`, `pickOptions`

## words

**File**: `js/words/words.js` · **Layer**: domain

Word rules. `normalizeDraft` trims and converts leftover rōmaji in the reading to hiragana;
`validate` requires a kana-only reading and a meaning; `duplicateKey` = writing|reading;
`extractKanji` = library kanji in the writing, in order, once, 々 skipped. `cardPlan(word, track)`:
Japanese → meaning = writing | reading | meaning [notes, example] (no writing: reading | meaning…);
Meaning → Japanese = meaning | reading | writing [notes, example] (no writing: meaning | reading…);
notes and example are the last step's `fold` (P24: label "Notes & example" or the one field's name), empty ones dropped. `matchesQuery` searches every field, and rōmaji/katakana queries match the reading.
`parsePaste` (P20) splits a pasted block in the AI chat's word format, empty lines skipped: line 1
is the writing when it holds a kanji or line 2 is a kana reading (P25: a kana word repeats its
kana; a writing equal to the reading is dropped; otherwise the older block that starts with its
reading), then reading, meaning (bullets kept); after the meaning the last line is the example
(`sentence - translation` on one line; dashes only = no example) and every line between is the
notes (2026-11-16; before, the order was the reverse);
null for fewer than two lines. `FIELDS` lists the fields in display order: notes before example.
Pitch accent (P23): the reading field takes the gem's notation — `[きょ]う` (the bracket marks the
accented mora; around several morae, the last), `とけい [flat]` (no accented mora), or nothing (not
known). `splitAccent` (called by `normalizeDraft`, so a draft carries `accent`: the mora's position
from 1, 0 flat, null not known) reads `[flat]` before rōmaji conversion, converts the rest with its
brackets, and counts `morae` (small ゃゅょぁ… join the kana before; っ, ん, ー stand alone); a bracket
left over stays in the reading and `validate` refuses it. `formatAccent` writes the notation back
for the form; `accentSplit` gives `{before, mora, after}` for display, null when nothing is
highlighted; `accentView` gives `{marked, flat}` for display (FLAT only when the accent is 0); `splitFlatMark` lets rōmaji suggestions work on the reading without its mark.
Quiz (P29): `quizPlan(word, track)` — Japanese → meaning: writing → reading, then writing + reading →
meaning (kana word: reading → meaning); Meaning → Japanese: meaning → reading, then meaning + reading →
writing (kana word: meaning → reading). `quizPools(word, step, groups)` gives other words' texts for
the asked field as pools to draw from, leaving out a word the prompt cannot tell apart (same text in
every shown field); where the step shows kana an option must agree with (a writing over a reading
choice, a reading under a kanji choice) the pools run best `kanaFit` first, each fit in the groups'
order (P30). `kanaFit(writing, reading)`: kanji runs stand for any kana, kana must match — Infinity
when it fits, else how many trailing kana match.
`copyText(words)`: one line per word, `writing⇥reading⇥meaning`, `-` for a kana word's writing.

**Exposes**: `TRACK_READ`, `TRACK_RECALL`, `TRACKS`, `TRACK_INFO`, `FIELDS`, `FIELD_LABELS`, `FLAT_MARK`,
`morae`, `splitAccent`, `formatAccent`, `accentSplit`, `accentView`, `splitFlatMark`, `parsePaste`, `normalizeDraft`, `validate`, `duplicateKey`, `extractKanji`, `headline`, `cardPlan`, `quizPlan`, `quizPools`, `kanaFit`, `copyText`, `matchesQuery`, `sortForList`

## sentences

**File**: `js/sentences/sentences.js` · **Layer**: domain

Sentence rules (P13). `splitTranslation`: the Latin/Cyrillic tail after the last Japanese letter
(closing `。）` etc. stay Japanese; a leading `— - : |` delimiter and wrapping brackets dropped).
`readAnnotations`: `()`, `（）`, `[]`, `［］` holding kana are readings; the token since the previous
bracket loses its leading non-kanji except お/ご, and when it holds several kanji runs the earliest
start whose kana align with the reading wins (日本語を勉強（べんきょう） → 勉強; 落ち着いて stays whole);
a bracket after a kana-only token is dropped, one without kana stays as text; the sentence reading
is filled only when no kanji or Latin is left. `parse` = both; `canParse` = Parse would change
something. `parsePaste` (P20): a pasted block, empty lines skipped — line 1 through
`readAnnotations` (no translation split), line 2 the translation, every further line the notes;
null for fewer than two lines. `candidates(sentence, known)`: known/bracketed words where they occur, then every other
kanji run (with a preceding お/ご) with an empty reading, in order, each once; kana-only words never.
`exampleFor` = sentence + newline + translation. Reading optional, rōmaji → hiragana, no kanji or
Latin. Conjugated forms stay as written; their dictionary form goes in the meaning, by hand.
Reviews (P19): tracks `sentences.read` (Japanese → translation) and `sentences.recall` (Translation
→ Japanese); `isReviewable` = it has a translation; `cardPlan`: read = sentence | reading (only with
kanji and a reading) | translation + notes; recall = translation | sentence + reading + notes.

**Exposes**: `FIELDS`, `FIELD_LABELS`, `TRACK_READ`, `TRACK_RECALL`, `TRACKS`, `TRACK_INFO`,
`isReviewable`, `cardPlan`, `splitTranslation`, `readAnnotations`, `parse`, `parsePaste`, `canParse`,
`candidates`, `exampleFor`, `normalizeDraft`, `validate`, `matchesQuery`, `sortForList`

## kanji

**File**: `js/kanji/kanji.js` · **Layer**: domain

Library membership and order from `kanji-index`; search (kanji in the query → membership; kana →
reading contains; Latin → meaning word-prefix, or the query as kana prefixes a reading);
`cardPlan(track)`: Kanji → meaning = glyph | meaning | readings, strokes, components, your words,
your sentences; Meaning → kanji = meaning | glyph, strokes | readings, components, your words, your
sentences (stroke order comes with the glyph when the glyph is the answer). `wordsUsing` / `sentencesUsing`: the
learner's words (writing) and sentences (sentence text only) that contain a kanji.

**Exposes**: `TRACK_READ`, `TRACK_RECALL`, `TRACKS`, `TRACK_INFO`, `LEVELS`, `isLibraryKanji`,
`indexEntry`, `compareKanji`, `allKanji`, `matchesQuery`, `cardPlan`, `wordsUsing`, `sentencesUsing`

## storage

**File**: `js/core/storage.js` · **Layer**: infrastructure

The only `localStorage` user; key `hino_lite_v2`, which is also the backup format
`{app: 'hino_lite', version: 2, updatedAt, unsavedSince, settings{runSize, theme, lastBackupAt},
kana, words, sentences, kanji{addedAt, removed}, reviews{track: {id: {score, seen, lastSeen, unknownSince}}}}` (`unknownSince`, P26, is additive under v2).
`sentences` (`{id, sentence, reading, translation, notes, createdAt, updatedAt}`) is additive under
v2: `normalize` defaults it to `{}`, so older v2 data and backups load unchanged. Deleting a sentence
drops its `sentences.*` review scores and leaves the words made from it. Older copies never destroy newer data: `normalize` keeps unknown keys
(top level, settings, each word and sentence) as they are, and `load` starts listening for the
`storage` event, so another tab's save replaces this tab's copy instead of being overwritten by it. A missing
review entry means unseen (−1). Removing a kanji keeps its review entries; deleting a word drops
its own. A word's `accent` (P23, additive under v2) is a whole number from 0 or null; words saved
before it load as null. `normalize` rebuilds any untrusted JSON; `importText` refuses files without
`app: 'hino_lite'`, v2 (old Kana SRS backups). `backupStatus().due` after 7 days of unsaved changes.
Stores values computed by the rule modules and applies no rule itself.

**Exposes**: `STORAGE_KEY`, `APP_ID`, `VERSION`, `THEMES`, `BACKUP_NUDGE_MS`, `normalize`, `load`,
`save`, `isAvailable`, `requestPersistence`, `isPersisted`, `getSettings`, `setRunSize`, `setTheme`,
`kanaStats`, `recordKana`, `listWords`, `getWord`, `saveWord`, `deleteWord`, `listSentences`,
`getSentence`, `saveSentence`, `deleteSentence`, `kanjiEntry`, `setQuizScore`, `restoreReview`,
`isEnrolled`, `listKanji`, `enrollKanji`, `removeKanji`, `reviewStats`, `recordReview`,
`setReviewScore`, `exportText`, `markBackedUp`, `backupStatus`, `importText`, `reset`, `raw`

## library

**File**: `js/kanji/library.js` · **Layer**: infrastructure

Downloads the 12 level files (N5 first) into `hino-lite-library-<LIBRARY.version>` on the first
Kanji-tab visit and drops older versions; reads go straight to that cache, memoised per level, so
a level is either fully stored or reported missing. Detail shape: `{m, alt, on, kun, comp: [[glyph, meaning, link | null]],
band, words: [[word, reading, gloss, rank, pitch[], senses[]]]}`.

**Exposes**: `CACHE_PREFIX`, `CACHE_NAME`, `LEVELS`, `TOTAL_BYTES`, `supported`, `isDownloading`,
`readyLevels`, `download`, `detail`, `strokeSvg`, `details`

## sw

**File**: `sw.js` · **Layer**: infrastructure

Cache-first precache of `ASSETS` into `CACHE_NAME` (`hino-lite-app-v10`), fetched with
`cache: 'reload'`; activation deletes every other bucket except `hino-lite-library-*`. Serves
library files from their cache too. Bump `CACHE_NAME` on every release.

## dom

**File**: `js/core/dom.js` · **Layer**: presentation

`h()` element builder (text as text, `html:` for trusted markup), `fill(el, ...children)` to redraw an
element by `h()`'s child rules (the native `replaceChildren` prints a `null` child as "null"), `ja()` for Japanese spans,
`button`, `segmented`, `part` (a labelled block of a card or review step), `filterGroup` (a labelled group of a list toolbar), `listGroup` (a titled
list section with a hairline heading; `actions` put buttons at the end of the heading's row), `pasteBlockField` (a textarea that takes one typed line and
a pasted block: Enter moves to the next field instead of breaking the line, so a line break can only
come from a paste — the context menu, Ctrl+V or a phone keyboard's clipboard strip, which fires no
paste event; the block goes to a callback with the value from before the paste, a single line just
loses its breaks), `toast`, `formatDaysAgo`, and `confirmAction`/`notify` — the single seams the
smoke test answers.

`jaReading` draws a word's reading with its accent from `words.accentView`: the nucleus in bold (`.accent-mora`), or a FLAT label (`.accent-flat`) whose tip (`#tip`, one for the app, placed under or above its label) explains a flat word; the tip opens on mouse hover, and on a tap or Enter only when `tappable` (a list row or a review card owns its tap); a press elsewhere, Escape, scroll or back closes it (`hideTip`).

**Exposes**: `$`, `h`, `fill`, `ja`, `jaReading`, `hideTip`, `button`, `segmented`, `part`, `filterGroup`, `listGroup`, `pasteBlockField`, `confirmAction`, `notify`, `toast`, `formatDaysAgo`

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

The self-rated run shared by words, kanji and sentences: an adapter gives the run, `plan(item)` and
`renderPart(item, key, asPrompt)`; beside the prompt, the card's score as two columns of dots (P27:
one per point, the left column up to `LEARNED_AT`, the right up to `CONFIDENT_AT`, lit in the
state's colour, rings on a card never answered; the score from before the answer, unchanged by a
rating — contract 9); the main button / card tap reveals the next step, "Show all"
reveals the rest; a step's `fold` keys render under one `<details class="review-fold">` toggle, closed
on every new card (P24); a fully revealed card is no longer a button (no role, tap or keys) and carries `.done`, then four rating buttons in `.review-controls` and, outside them in `.rating-help`, the "Which one do I press?" help (no points). Kids
theme cheers a good rating. Summary: counts per rating, newly learned, per-item rows, "Run again"
(accepts a promise). Also the `trackPanel` (run length + one row per track) and `stateDots` used
by the three tabs, and `trackRow` (a direction's name, state and four steps lit up to the state, no
points) that the word sheet, the sentence sheet and the kanji card build their progress panels from.

**Exposes**: `startReview`, `trackPanel`, `meter`, `stateDots`, `trackRow`

## quiz-ui

**File**: `js/review/quiz-ui.js` · **Layer**: presentation

The quiz screens (P29, `#screen-quiz`, `#screen-quiz-summary`), given an adapter: `plan(item)` steps,
`answer`, `options`, `askLabel`, `renderPart` (the review adapter's) and `renderOption`. Each step:
the shown fields on the review card (the first as the prompt, the rest as a `.review-step`), "Pick
the …", four options in the kana drill's `.options` grid; a pick marks the right option green and a
wrong pick red (shaking, unless motion is reduced); before the last step the next one follows after
`STEP_PAUSE_MS` 500, the last step waits for Next word / Finish (P30). An item is scored when its last step is answered
(`quiz.quizScore` → `storage.setQuizScore`: the score only, never `seen` or `lastSeen`, so run order is
untouched), with copies of its entry before and after. The summary
lists only the items `quiz.promoted` out of unknown, each with Undo / Redo
(`storage.restoreReview`); with none, one general note. "Quiz again" / Done. Started from the quiz
sheet, it takes over the sheet's back entry.

**Exposes**: `startQuiz`

## words-ui

**File**: `js/words/words-ui.js` · **Layer**: presentation

Words tab (review panel; a toolbar panel with the labelled search; the list: a Least known copy
group first (`review.leastKnown`, P28; Copy puts the whole list on the clipboard via `W.copyText`, Quiz
opens a sheet with one Start per direction counting its unknown words, then `quiz-ui` with
`W.quizPlan`, options by `W.quizPools`: kana that fit the prompt first, each fit from least known →
learning → the rest — P29, P30), then the progress groups
New · Learning · Learned · Confident by `review.progressGroup`, empty groups hidden, newest first
inside a group, two columns from 720 px), word sheet (hero: the word and its reading with a
progress panel — both directions as lit steps and "Mark as known" until both are learned —
under them on a phone, beside them from 720 px; then meaning and kanji chips as hairline rows,
side by side from 720 px with the kanji column starting under the progress panel (a meaning
without kanji spans the row), then notes and the example, each across the full width (`.part.wide`);
Edit/Delete on the right), the word review's kanji, reading and meaning as `.part.main` (centred on a phone) and its notes and
example as `.part-text.extra` (a size smaller on a phone); a meaning past ~40 characters, as the
Meaning → Japanese prompt or the revealed answer, carries `long` (past ~80, `longer`) — `meaningSize`,
sized down by `review.css` only on a `.done` card,
add/edit form (Kanji, Reading, Meaning | Notes in a grid, two columns from 900 px where Notes stretch
to the column's height; Example below the grid at full width, still a textarea because words made
from a sentence keep sentence and translation on two lines; the Kanji field is a one-line textarea via `dom.pasteBlockField`, so a pasted block
fills the form through `W.parsePaste` — it overwrites the fields the block fills, the Kanji field
always — with "Filled from the pasted lines" and an Undo that restores the fields as they were
before the paste; rōmaji suggestions as hiragana/katakana chips, live "Adds to your kanji" preview,
duplicate refusal with "Open it"; the Reading field holds the accent notation, shows a word's accent
that way when editing (`W.formatAccent`) with an "Accent:" preview under it, and rōmaji suggestions keep
a `[flat]` mark), save → `storage.saveWord` + `enrollKanji`; the word review adapter. Every reading it
shows — list row, sheet hero, a kana word's headline, the review's reading part and prompt, the run
summary — shows its accent (`readingNode` → `dom.jaReading` with `W.accentView`): the nucleus in bold, FLAT for a flat word; the FLAT tip opens on a tap only on the word sheet and in the form's preview.

**Exposes**: `renderWords`, `openWordView`, `openWordForm`

## sentences-ui

**File**: `js/sentences/sentences-ui.js` · **Layer**: presentation

Sentences tab (review panel for the sentences with a translation, or a hint when none has one; the
labelled search toolbar; the list: a Least known copy group (`review.leastKnown`, P28), then the
progress groups via `review.groupByProgress`, one column,
newest first inside a group; an untranslated row reads "No translation — not in reviews" and has no
state bars), sentence sheet (reading, a progress panel laid out as the word sheet's — both directions
and Mark as known, or "Add a translation to review this sentence" — translation, notes, Edit,
Delete — its scores go, words made from it stay), add/edit form (Parse button while `canParse`, Undo restores
the pasted text; the Sentence field takes a pasted block via `dom.pasteBlockField` and `S.parsePaste`
fills the form at once — its bracketed words join the prompt's known readings, and the same Undo
restores the fields as they were before the paste; rōmaji reading preview). Every save (new or edit)
enrolls the sentence's library kanji via `enrollKanji(…, { restoreRemoved: false })` — a kanji the
learner removed stays removed — and the toast names the ones added; no retroactive pass over older
sentences. Saving a **new** sentence with kanji opens the word-card
prompt (replaces the form's back entry): one row per candidate with editable kanji and reading and
an empty meaning, plus a notes textarea collapsed behind "+ Notes" (a dot marks collapsed notes that
hold text); Add is enabled once meaning and reading are filled, saves the word with the
sentence as its example and the notes, and enrolls its kanji; a word already in the list (writing|reading) is only
marked. Edits never prompt. The sentence sheet also opens from a kanji card's "In your sentences".
The sentence review adapter: runs over the reviewable sentences, renders `S.cardPlan`'s parts.

**Exposes**: `renderSentences`, `openSentenceView`

## kanji-card

**File**: `js/kanji/kanji-card.js` · **Layer**: presentation

Kanji card in the sheet, ported from JLPT_coach's. Hero: glyph, level, meaning + also, and a
progress panel (per track a `review-ui.trackRow`: name, state, four steps lit up to the state —
never points; Add / Remove / Mark as known, hidden once `review.isKnown`); on a phone the panel drops under the glyph. Then stroke order beside the
readings panel (readings, then components, each opening its `link` kanji — 亻 opens 人; no radical row; stacked on a phone), "In your words" and
"In your sentences" (kanji marked; 3 + show all; opens the sentence sheet), example words (8 + show
all) → word sub-view with pitch-accent diagrams and "+ Add to my words" (opens the prefilled form)
or "In your words ✓". Own view stack with ←; the learner's words and sentences open their own
sheets in place of the card. `partsList` (component chips; buttons only when given an opener) and
`markKanji` (learner text with the kanji as `<mark>`, text nodes only) also serve the kanji review.

**Exposes**: `openKanjiCard`, `readingsNode`, `partsList`, `markKanji`, `pitchSvg`

## kanji-ui

**File**: `js/kanji/kanji-ui.js` · **Layer**: presentation

Kanji tab: starts the one-time download on first open (progress, retry, offline message), review
panel (enabled once the enrolled kanji's levels are stored), a library toolbar panel (`dom.filterGroup`) with three labelled
groups in one row on a tablet (Show: Mine/All · JLPT level: the levels as one multi-select segmented
control · Search; each takes a full row on a phone), level
sections of tiles with state dots under hairline headings (`dom.listGroup`); the kanji review adapter (preloads details
and strokes). Review parts: a revealed glyph (`.reveal-glyph`) sits beside its stroke order
(`.reveal-strokes`) without labels when the plan reveals both in one step, otherwise stroke order is a
labelled part; components as plain chips; the learner's words (≤ 4: writing with the kanji marked,
reading with its accent via `words.accentView` (FLAT's tip on hover only), meaning clamped to two lines) and sentences (≤ 2: sentence, reading, translation) as plain
`.use-row`s — nothing on the card is a button, since the card is one tap target.

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
controls, among them the list toolbar `.filters` and the titled list sections `.list-group`, a reading's accent (`.accent-mora` bold, coloured `--muted-accent` only in the list's and sheet's grey readings; the `.accent-flat` label and its `.tip`); kana screens), `css/review.css` (track panel, the cards' progress panel and step rows,
review card (its minimum height on the prompt zone, which centres the prompt; the `.score-dots` columns out in the card's side padding, `--card-pad-x`), ratings (on a phone, ≤ 520 px, a `.done` card's `.review-controls` sticks to the bottom edge dressed like the tab bar, buttons 56 px; wider screens keep them after the card), a long meaning's `.long` / `.longer` steps on a `.done` card (prompt 28 → 22 → 19 px, revealed meaning 19 → 17 → 16 px), help, summary; the quiz's options (a wrong pick shakes, no motion under `prefers-reduced-motion`); a word's notes and example (`.part-text.extra`) a size smaller on a phone, its kanji, reading and meaning (`.part.main`) centred there; the `.review-fold` toggle (a part label in the accent colour with a turning chevron; one folded part hides its own label); the kanji review's glyph beside its stroke order — side by side
via `:has()`, stacked and centred without it — and the `.use-row`s of words and sentences), `css/words.css` (progress-group grid, two columns from 720 px, word rows, form with the one-line Kanji field and Notes stretched beside Reading and Meaning from 900 px, the Parse bar both forms use, word sheet with its hero row, meaning beside kanji (the kanji column as wide as the progress panel, `--hero-panel`), notes and example as full-width rows;
its `.field*` classes serve the sentence form too; the word sheet's field grid),
`css/sentences.css` (progress-group rows with state bars, one column; form; sheet with
the progress panel under the sentence on a phone, beside it from 720 px; word-card prompt rows and their collapsible notes;
the sentence review's text and summary rows), `css/kanji.css` (the JLPT level control's padding, tiles, card hero with the
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
server; `shots` screenshots `scene.html` scenes (including the word sheet, the word form at both sizes, a fully revealed word review and the kanji reviews) at 390×844 and 1280×800.

## selftest-page, selftest

**Files**: `tools/selftest.html`, `tools/selftest.js` · **Layer**: tooling

Imports the shipped rule modules as they are and asserts kana tables/rules, rōmaji conversion,
review scoring, progress groups, the least-known group and run composition, the quiz (score, run,
options, plans, candidates and their kana fit, copy text), word (pasted blocks), sentence (Parse, pasted blocks, candidates, tracks,
reviewability, reveal plans) and kanji rules, storage
normalisation.

## browser-smoke-page, browser-smoke

**Files**: `tools/browser-smoke.html`, `tools/browser-smoke.js` · **Layer**: tooling

Drives the real app in an iframe: kana runs and themes, word add/validate/duplicate/edit/search,
both word reviews (notes and example folded and closed, the revealed card not a button, the toggle opening them, the example `.extra`; reading and meaning `.part.main`; a revealed card `.done`, a short meaning unsized, the ratings unpinned at the 900 px frame with the help link outside them) and the rating help, the word sheet's meaning and kanji row with the kanji under the progress panel, both sentence reviews (only translated sentences, the reveal
steps, own tracks), the sentence list's groups, the sentence sheet's panel and Mark as known, an
untranslated sentence's hint, scores dropped with a deleted sentence, the word list's progress groups (New, then Learning /
Learned after reviews and Mark as known; two columns at tablet width), library download, Mine/All/levels/search and the labelled
toolbar in one row at tablet width, kanji card
(progress panel, parts in the readings panel, components, example words, add to my words),
remove / add / mark as known, both kanji reviews (Kanji → meaning: stroke order only in the last
step; Meaning → kanji: the glyph drawn large beside its stroke order, then readings, components and
the learner's words and sentences with reading and meaning/translation, nothing tappable), backup
round trip and reminder, sentences (Parse/Undo, word-card prompt with readings and collapsed notes saved on Add, already-in-list,
plain sentence with a rōmaji reading, search, a kanji card listing and opening its sentences, saving
and editing a sentence enrolling its kanji (a removed one stays removed), edit without prompt, backup, delete keeps words), pasted blocks (P20: the one-line Kanji field and Enter moving on, a
single line losing its break, word and kana-word blocks, sentence block with its readings reaching the
prompt, Undo back to the fields before the paste),
the Least known group (P28: order, copy in Learning, search) with Copy and the quiz (P29: the sheet's
counts, meaning → reading → kanji with step 2 coming by itself, scoring, seen and last seen untouched, a summary of only the promoted word, Undo, the note when
none is promoted), no stray "null" text on the empty Words screen, the review summary and the quiz, another tab's save taken over and newer-version keys kept, Android back, service worker install.

## scene

**File**: `tools/scene.html` · **Layer**: tooling

Seeds sample data and drives the app (iframe sized to the requested width) to one screen for
`check.py shots` (the kanji-review scenes walk the run to 学's card, which has a word and a sentence;
`review-full` walks the word run to 勉強, which has notes and an example, and reveals it all; `review-open` also opens the fold; `quiz` stops on 先生's meaning step with a wrong pick, `quiz-summary` promotes 勉強); holds its load event on `/__delay` so the screenshot waits for real work.
