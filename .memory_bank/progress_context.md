# Progress Context — Hino Lite (formerly kana_srs)

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
