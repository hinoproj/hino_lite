# Progress Context — Hino Lite (formerly kana_srs)

## [2026-11-05] Words tab: list grouped by progress, two columns, labelled search (P18)

The owner asked for separated sections on the Words tab and for the list in two columns on wide
screens, grouped by progress from least known (unseen) to learned, separated by hairlines the way
the Kanji tab separates its levels. Three questions were put to the owner, who picked all three
recommendations. (1) Group rule over both directions: New only if never answered either way,
Learned/Confident only when both are, everything else Learning. (2) Four groups, matching the
review panel's buckets. (3) The search in the same labelled toolbar panel as Kanji.
New rule `review.progressGroup` + `PROGRESS_GROUPS` (selftest +1). `words-ui.js`: `fillList`
groups the matching words (empty groups hidden, newest first inside a group); `wordRow`;
`wordScores` shared with the word sheet. The toolbar and the hairline section heading are now
shared: `dom.filterGroup`/`dom.listGroup`, their CSS moved from `kanji.css` to `app.css` (`.filters`,
`.filter*`, `.list-group`, `.group-head`); `kanji-ui.js` uses them too (Kanji tab renders unchanged).
`words.css`: `.word-list` → `.word-grid`, two columns from 720 px. The smoke test's Kanji toolbar
selectors are now scoped to `#screen-kanji` (both screens hold a `.filters`); +2 checks (New group under a
labelled search; regrouping after reviews and Mark as known, two columns at 900 px).
`tools/scene.html`: 学校 got a recall score, so the words shot shows New, Learning and Learned.
README describes the groups. `sw.js` stays `hino-lite-app-v7` (unreleased). Selftest 154/154, smoke
104/104. Screenshots reviewed: phone dark and Kids, tablet landscape dark and Light, tablet portrait.

## [2026-11-05] Kanji tab: labelled library toolbar, separated level sections (P17)

The owner found the Kanji tab one continuous run with no separation: Mine/All, six loose level
pills and the search each on their own line under the review panel. The review panel is left as it
was. The owner's direction was "one row with labels"; the layout was built directly, without mocks.
`js/kanji/kanji-ui.js`: the filters are a toolbar of three labelled groups (`filter()` helper):
**Show** (Mine/All), **JLPT level** (the six levels as one joined segmented control, still
multi-select; `.level-chip` and `data-level` kept for the smoke test), **Search** (a real
`<label for>`). `css/kanji.css`: the toolbar is its own panel, 24 px below the review panel, groups
bottom-aligned in one row (search fills the rest, 50 px tall to match the segmented controls); at
≤ 600 px each group takes a full row and the segmented buttons stretch. Level headings carry a
hairline to the edge and 22 px between levels. The row holds at 1280 and 800 px wide.
`sw.js` → `hino-lite-app-v7` (v6 is live). Smoke +1: the three labels in order and one row at the
900 px test frame (153/153, 102/102). Screenshots reviewed: phone dark and Kids, tablet landscape dark and Light,
tablet portrait.

## [2026-11-05] Kanji card zones restyled (P16)

Four mocks of the card's zones (strokes panel + hairline rest, all hairline, reference row boxed,
no rules) were rendered over the real 学 card and declined; the owner specified the change instead.
`css/kanji.css`: `.zone` lost its fill and its 14 px radius — square outlines on the sheet's paper;
`.strokes-zone` keeps `--surface` (with the hero's progress panel, the card's only filled objects);
new `.examples-zone` (set in `kanji-card.js`) shows only its left rule; `.reading-pill` square;
`.part-chip` and `.example-row` without background; `.kanji-card .chip` square (chips elsewhere —
level filters, reading suggestions, the word sheet's kanji — stay round). The reading pill is also
square in the kanji review's Readings step, the same element. `sw.js` → `hino-lite-app-v6` (v5 is
live). Smoke: the card check also requires the example rows inside `.examples-zone`. Screenshots
reviewed at 390×844 and 1280×800 plus a 1500 px-tall card, dark theme.

Mock tooling note: headless Chrome with a profile under a deep folder fails the library download
("Failed to execute 'put' on 'Cache': Entry already exists") — Cache Storage paths pass Windows'
260-character limit. `check.py` uses a short temp profile and is unaffected; ad-hoc shots need one too.

## [2026-11-05] Word sheet: progress panel and "Mark as known" (P15)

The word sheet still showed its two review states as chips ("Japanese → meaning: unseen") at the
bottom. It now has the kanji card's progress panel, with both directions as lit steps (no points)
and **Mark as known** (confirmed; both directions to learned, never lowered), hidden once both are
learned. Words have no add/remove. Layout went through two reviews with the owner and ended on mock variant **E**
(five static mocks compared: tiles, one panel, hairline rows, balanced tiles, and E). On a phone the
word is centred and the panel stacked under it, capped at 420 px and centred so it sits inset from
the sheet's edges. On a wide sheet (≥ 720 px, app.css's dialog breakpoint) the word is left-aligned
on the fields' 10 px inset and the panel sits beside it at the trailing edge, 250 px wide. Meaning,
example, notes and kanji are **hairline rows without boxes**, inset 10 px, two columns on a wide
sheet. Edit and Delete are aligned right.

The step row is now shared: `review-ui.trackRow` (moved from `kanji-card`), with its CSS moved from
`kanji.css` to `review.css`; `.progress-panel` carries its own surface instead of borrowing
`.zone`. New rule `review.isKnown` replaces the inline "both learned" check on both cards.
`.states`/`.state-chip` removed from `app.css` (no users left); `.word-view > .actions` so the
sheet's bottom margin no longer hits the panel's buttons. `sw.js` → `hino-lite-app-v5` (v4 is
live). Selftest +1, smoke +3 (153/153, 101/101); `tools/scene.html` gained a `word` scene and
`check.py shots` shoots it at 390×844 and 1280×800 (dark theme reviewed).

## [2026-11-03] Kanji card relaid out; "In your sentences" on the card

The owner found the card's state chips and buttons floating between the hero and the zones
(tablet, Kids theme). Three static mocks were compared; the owner picked **B**, with stroke order
and readings stacked on a phone. `js/kanji/kanji-card.js` + `css/kanji.css`: the hero is glyph |
meaning + also | a progress panel (per review direction: name, state and four steps lit up to the
state — no points, in the spirit of contract 9 — plus Remove / + Add to my kanji / Mark as known);
below 600 px the panel drops under the glyph row. Then stroke order beside a readings panel that
now also holds radicals and components (compact glyph + meaning chips; a linkable component shows
›); stacked on a phone. Then "In your words" and the new "In your sentences" (side by side when
both fit), then example words. Unlit steps use a tint of `--muted`, because the Kids theme's `--line`
is amber and read as "learning".

The card had no link to the Sentences list: `kanji.sentencesUsing` (pure, matches the sentence text
only) feeds "In your sentences" (the kanji marked in the accent colour, 3 + show all); tapping one
opens the sentence sheet (`sentences-ui.openSentenceView`, now exported) in place of the card, the
same way "In your words" opens the word sheet. `sw.js` → `hino-lite-app-v4` (v3 is live). Selftest
+1, smoke +3 (152/152, 98/98); the smoke test reads a component link's target from `data-kanji`
(the chip now also holds the meaning). `tools/scene.html` gained a 学 sentence for the card shots.
Screenshots reviewed at 390×844 and 1280×800 in all three themes.

## [2026-11-02] Older copies of the app can no longer wipe newer data

Fixes the known issue logged with the Sentences tab. Saves write the whole document, so (a) an older
version's `normalize()` dropped keys it did not know, and (b) any tab left open — even of the same
version — wrote its stale copy over other tabs' saves (a word added in tab A vanished when tab B
saved). `js/core/storage.js`: `normalize()` keeps unknown keys at the top level, in settings and in
each word and sentence (`__proto__` skipped); `load()` listens for the `storage` event and adopts
another tab's save. Protects future updates; copies already installed before this release still
have the old behaviour. Selftest +2, smoke +2 (151/151, 95/95). `sw.js` stays `hino-lite-app-v3`
(not yet released).

## [2026-11-02] Sentences tab: Parse and word cards from a sentence (P13)

Owner's design, recorded as P13 in `.agentic_docs/current_task.md` (P3 and P10 amended).

**Shipped**

- `js/sentences/sentences.js` (rules): `parse` = `splitTranslation` (Latin/Cyrillic tail) +
  `readAnnotations` (bracket readings, kana-alignment to find where the word starts, お/ご kept,
  kana-only tokens skipped); `canParse`; `candidates` (Parse's words where they occur, other kanji
  runs with an empty reading); `exampleFor`, validation (reading optional, rōmaji → kana), search.
- Storage: `sentences` collection, additive under v2; `listSentences`/`getSentence`/`saveSentence`/
  `deleteSentence`. Existing data and backups load unchanged.
- `js/sentences/sentences-ui.js` + `css/sentences.css`: fifth tab (Kana · Words · Sentences · Kanji
  · Settings), list + search, sheet, form with Parse/Undo, word-card prompt after a new sentence.
  `sw.js` → `hino-lite-app-v3` with the three new files.
- Tests: 24 selftest checks, 22 smoke checks, scenes `sentences`, `sentence-form`, `sentence-words`.

**Decisions made during the build**

- Parse also shows for a trailing translation without brackets (owner's spec named brackets only).
- Add needs a reading as well as a meaning, because a word without a reading cannot be saved; rows
  for un-bracketed kanji start with an empty reading.
- Example = sentence, newline, translation. Rows marked "Already in your list" hide their meaning field.

**Known issues**

- Touching kanji runs merge into one candidate: 毎日学ぶ offers 毎日学 (the agreed rule is "each
  run of kanji"); the row's kanji field is editable. `candidates()` in `js/sentences/sentences.js`.
- `storage.normalize()` keeps only known keys, so an older app version running after sentences
  exist would drop them on its next save (e.g. a second tab still on the old code). Only reachable
  across an update; the new version never loses them.

**Verified**

`uv run tools/check.py`: selftest 149/149, smoke 93/93. Screenshots of the new screens at
390×844 and 1280×800 reviewed.

## [2026-11-02] Readings may hold punctuation (phrases like "Jaa, mata")

First device report: the reading じゃあ、また was refused. `toHiragana` now turns `, . ! ? ~` into
`、 。 ！ ？ 〜` and drops the spaces around them; `isKana` accepts Japanese punctuation
(、。！？「」『』…) as long as there is at least one kana. Selftest cases added; `sw.js` cache
→ `hino-lite-app-v2`. Folder renamed and first push to Pages done by the owner the same day.

## [2026-11-01] Hino Lite: words, word review, kanji library, kanji list and review

Renamed Kana SRS to **Hino Lite** and extended it; owner's decisions P1–P12 in
`.agentic_docs/current_task.md`. Git remote → `https://github.com/hinoproj/hino_lite.git`; the
local folder rename `kana_srs/` → `hino_lite/` was blocked by a lock and is left to the owner.

**Shipped**

- ES modules, no `file://`, no Node. Kana files moved with `git mv` into `js/kana/` (rules
  unchanged); `storage.js` → `js/core/storage.js` rewritten for format v2 (`hino_lite_v2`).
- Rules: `js/core/romaji.js` (IME-style rōmaji → kana), `js/review/review.js` (four ratings on
  JLPT_coach's scale, D56 labels, run composition), `js/words/words.js`, `js/kanji/kanji.js`.
- Library: `tools/build_library.py` → `data/library/<level>.json` + `.strokes.json` (12 files,
  ~6.7 MB) and `js/kanji/kanji-index.js` (207 KB, version `d15bcc98f5`); `js/kanji/library.js`
  downloads on first Kanji-tab visit into its own cache.
- UI: bottom tabs, sheet, back stack (`shell`), words list/form/sheet, shared review run and
  summary with rating help, kanji tab (Mine/All, levels, search, tiles), kanji card ported from
  JLPT_coach (strokes, readings, radicals/components, example words with pitch accent, add to my
  words, add/remove/mark known), settings with one backup file and a weekly reminder.
- `sw.js`: app cache `hino-lite-app-v1` (fetched with `cache: 'reload'`), never deletes library
  buckets. Manifest and icon renamed.
- Tools: `tools/check.py` (serve, run browser tests headless, screenshots), `tools/selftest.html/js`
  (replaces the Node selftest), `tools/browser-smoke.html/js`, `tools/scene.html`.

**Decisions made during the build**

- New-card cap is hard (a fresh list gives a 5-card first run, not 10 new words); short runs
  backfill with known cards only.
- Rōmaji follows Hepburn: `nn` + vowel/y is ん + な/にゃ-row (konnichiha, konnyaku); 金曜日 is typed
  `kin'youbi`.
- Kanji review needs the library downloaded; the card works from the shipped index before that and
  says the download is unfinished.
- Headless Chrome will not render narrower than ~500px, so screenshots size the iframe instead.

**Verified**

`uv run tools/check.py`: selftest 117/117, smoke 71/71 (headless Chrome). Screenshots of words,
form, review, kanji tab and card at 390×844 and 1280×800 reviewed. Not run on the real devices yet.

## [2026-11-01] Mistake replay: wrong MCQ picks come back as options

- `js/srs.js`: `MISS_LIMIT` (= `OPTION_COUNT − 1` = 3) and `pushMiss()`; `buildQuestion` now takes
  a `misses` list (signature `item, deck, mode, misses, rng`) and puts those kana in the
  wrong-option slots before look-alikes and random fill.
- `js/storage.js`: entries gain `misses` (kana keys, newest first). `record(mode, key, score,
  misses, correct)` now stores values computed by `srs` — it used to apply the 0 floor itself,
  duplicating `SRS.applyPoints`, a scoring rule outside `srs` (layer contract 3). Fixed.
- `js/app.js`: questions are built with the kana's stored misses; a wrong tap passes the picked
  option's key; the score comes from `SRS.applyPoints`.
- `index.html`: Settings "Mistakes" panel; `README.md` "Mistakes" section. `sw.js` `CACHE_NAME` v3.
- `AGENTS.md`: contract 5 allows a purely additive field under the same key; the scoring
  cross-cutting row now covers the mistake rule.
- Decisions with the owner: per kana per mode, keep the last 3 (one per wrong-option slot); a
  pick leaves only when pushed out (answering correctly does not clear it); all 3 slots may be
  misses; Type mode untouched; run composition unchanged; storage key stays `kana_srs_v1`.
- Verified: selftest 54/54 (10 new); browser smoke 36/36 in headless Chrome (3 new: wrong pick
  saved, misses survive export/import, an old-shape import loads with empty lists).

## [2026-09-15] Themes: Dark / Light / Kids switcher in Settings

- `css/app.css`: palettes moved from a `prefers-color-scheme` media query to explicit
  `:root[data-theme="dark|light|kids"]` blocks; kids adds a warm gradient body, coral/teal accents,
  bolder options, a pop animation on the correct option and a shake on a wrong one.
- `js/storage.js`: `settings.theme` (validated against `THEMES`, default `dark`), `setTheme()`;
  unknown values in an import fall back to the default.
- `js/app.js`: `applyTheme()` stamps `<html data-theme>` and rewrites the `theme-color` meta;
  theme picker (segmented control) in Settings; kids-only verdict cheers (Yatta!/Sugoi!/…) and a
  summary line (Amazing!/Great job!/Keep going!).
- `index.html`: Theme panel, `#summary-cheer`, id on the theme-color meta. `sw.js`: `CACHE_NAME`
  bumped to v2.
- Verified: selftest still 45/45; browser smoke extended with 9 theme assertions (33/33 pass);
  screenshots of home/run/summary/settings reviewed in all three themes.

## [2026-09-13] Project created: full kana SRS app, first working version

Built the whole app from an empty repository in one session.

**Shipped**

- `js/kana-data.js` — 214 kana across 6 decks (hiragana/katakana × basic 46 / dakuten 25 /
  yōon 36), katakana generated from the hiragana tables so the two cannot drift; Hepburn plus
  accepted Nihon-shiki/wāpuro spellings; shape-confusion groups with base-glyph inheritance.
- `js/srs.js` — timed scoring (+5 ≤3 s, +3 ≤5 s, +1 slower, −5 wrong; typed +3/−5; floor 0),
  states (learned 10, confident 25), per-kana-per-mode scores, run composition
  (≤3 learned + ≤1 confident + earliest not-learned in row order), question building.
- `js/storage.js` — guarded `localStorage` (`kana_srs_v1`) with in-memory fallback, plus JSON
  export/import and reset.
- `js/app.js`, `index.html`, `css/app.css` — five screens (home, deck, run, summary, settings),
  SVG timer ring that tiers green/amber/grey at 3 s and 5 s, tablet-sized touch targets, dark
  and light palettes.
- `sw.js` + `manifest.webmanifest` + `icon.svg` — installable offline PWA.
- `tools/selftest.js` (45 assertions, Node, no deps) and `tools/browser-smoke.html` (24 assertions,
  drives a real run in an iframe).

**Decisions made with the owner**

Split dakuten and yōon into their own decks rather than one "advanced" deck; typing mode on
hiragana only; no mode gating; soft timer (the ring stops at 5 s, no auto-fail); score floor 0;
run lengths 10/15/20; row-order introduction without a fixed new-kana cap per run; confusable-
weighted distractors; accept rōmaji spelling variants; ship export/import backup.

**Bugs found and fixed during verification**

- Distractor sampling could offer two options with the same rōmaji (ぢ/じ, づ/ず) because the
  eligibility filter was applied once per batch instead of once per pick.
- Pure weighted sampling surfaced a genuine look-alike only ~20 % of the time; questions now draw
  1–2 distractors directly from the confusion set.
- `.type-form { display: flex }` beat the browser's `[hidden]` rule, leaving the typing input
  visible during multiple choice; added a global `[hidden] { display: none !important }`.
- A miss on a kana already at score 0 displayed "Wrong +0"; the verdict and summary now report the
  points the answer earned rather than the clipped net change.

**Verified**

`node tools/selftest.js` — all 45 checks pass. `tools/browser-smoke.html` in headless Chrome —
all 24 checks pass, including a full 10-card run scoring +50, persistence to `localStorage`, the
0 floor, typed answers, the katakana deck offering only 2 modes, and an export/import round trip.
Screenshots of every screen reviewed.

**Not done**

Nothing pushed to GitHub yet; GitHub Pages not enabled (owner action). Never run on the actual
tablet — all verification was desktop Chrome, headless.
