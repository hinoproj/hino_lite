# Current task — Hino Lite: words, kanji library, kanji list (2026-11-01)

**Status:** built and verified 2026-11-01 (`uv run tools/check.py`: selftest 117/117, smoke 71/71;
screenshots at phone and tablet sizes reviewed). Folder renamed and pushed to Pages
2026-11-02 (`https://hinoproj.github.io/hino_lite/`). Sentences tab (P13) built and verified
2026-11-02 (selftest 149/149, smoke 93/93). Kanji card layout (P14) 2026-11-03 (152/152, 98/98). Word sheet progress panel (P15) 2026-11-05 (153/153, 101/101).
Open: device sessions with the learner.

Extends the kana drill into **Hino Lite**: kana + the learner's own words + a kanji library whose
kanji join a personal list automatically. Learner: the owner's son, on a phone (portrait) and a
tablet (landscape), offline, on-device storage only. Existing progress may be dropped.

## Decisions (owner, 2026-11-01)

| # | Decision |
|---|----------|
| P1 | Name **Hino Lite**, folder `hino_lite/`, repo `hinoproj/hino_lite` (public, GitHub Pages from `main` root). |
| P2 | Keep kana_srs's look and its Dark / Light / Kids themes. Kana drill unchanged. |
| P3 | Word card: kanji writing (optional), reading (kana only — rōmaji typed is offered as hiragana / katakana suggestions), meaning (any text), example (any text), notes (any text). One flat list; no file import — words also come from a sentence's word-card prompt (P13). |
| P4 | Word review, two modes with separate scores, no gates. **Japanese → meaning**: writing → reading → meaning + rest (no writing: reading → meaning + rest). **Meaning → Japanese**: meaning → reading → writing + rest. Main button reveals the next step, "Show all" is a shortcut, tapping the card = main button. No audio. |
| P5 | Rating: four self-rating buttons — Didn't know / Guessed / Knew it / Easy! — on JLPT_coach's kanji scale (first answer from 3, learned 5, confident 15, a miss on a learned card drops to 4, cap 30). "Which one do I press?" help never shows points. D56 labels: unseen · unknown · learning · learned · confident. |
| P6 | Run: 10/15/20 cards; ≤5 new (newest first, a hard cap), ≤3 learned/confident for maintenance (stale ones more likely), the rest in-progress cards, stalest first; when short, backfill with more learned/confident only — so a fresh list gives a 5-card first run. Same rule for words and kanji. |
| P7 | Kanji from a word's writing join the kanji list if they are library kanji (々 skipped). Nothing leaves automatically; "Remove from my kanji" (confirmed) hides it and keeps its progress. "Mark as known" sets learned in both modes. Manual "+ Add to my kanji" from the library. |
| P8 | Kanji library: all 2,099 kanji, grouped by JLPT level (N5…N1, no level), downloaded on first Kanji-tab open, one file pair per level (data + strokes), N5 first. Card = JLPT_coach's (strokes, readings, radicals/components, example words with pitch accent) + "In your words", state, actions, "+ Add to my words". |
| P9 | Kanji review: two modes — **Kanji → meaning** and **Meaning → kanji** — same reveal pattern and ratings. |
| P10 | Bottom tabs Kana · Words · Sentences · Kanji · Settings (Sentences from P13). One backup file for everything; reminder when unsaved changes are older than 7 days. Old kana_srs backups are refused. |
| P11 | ES modules, no `file://` support, no Node: rule tests and the UI smoke run in the browser, driven by `uv run tools/check.py`. User data in `localStorage` (`hino_lite_v2`) + `navigator.storage.persist()`. |
| P12 | Library files built by `tools/build_library.py` (uv, stdlib) from the platform repo's `data/`; output committed here. |
| P13 | (2026-11-02) **Sentences tab**, no sentence SRS yet. Form: Sentence (required), Reading (optional, kana), Translation, Notes; one sentence per add. **Parse** shows when brackets `()` `[]` (and full-width) hold readings or a Latin/Cyrillic tail is present: bracket = reading of the kanji token before it (leading non-kanji stripped except お/ご); kana-only tokens skipped; the tail goes to Translation, delimiter dropped. After a **new** sentence with kanji, a prompt lists its kanji words (bracketed ones with readings, other kanji runs with an empty reading); Add is enabled once meaning (and reading) are filled; the example is the whole sentence (+ translation); conjugated forms stay as written, the dictionary form goes in the meaning, typed by the learner; meanings are never prefilled; a word already in the list is only marked. Kanji join the kanji list as usual. No "Make word cards" button later; editing or deleting a sentence leaves its words untouched. |
| P14 | (2026-11-03) **Kanji card layout** (mock variant B): hero = glyph | meaning + also | progress panel (both review states as lit steps, no points; Add/Remove, Mark as known); stroke order beside a readings panel that holds radicals and components; then "In your words" and "In your sentences" (the learner's sentences containing the kanji; tap opens the sentence); then example words. On a phone the panel drops under the glyph and stroke order stacks above readings. Same layout in all three themes. |
| P15 | (2026-11-05) **Word sheet progress**, as on the kanji card: a progress panel (both directions as lit steps, no points); layout is the owner's mock variant E: on a phone the word centred and the panel stacked under it, capped and centred; on a wide sheet (≥ 720 px, where the sheet is a dialog) the word left-aligned and the panel beside it at the trailing edge, 250 px wide; meaning, example, notes and kanji as hairline rows without boxes, inset 10 px, two columns on a wide sheet; Edit and Delete on the right; the panel holds **Mark as known** (both directions to learned, never lowered, confirmed), hidden once both are at least learned. Words have no add/remove. |

## Tasks

1. Build script + generated library (`js/kanji/kanji-index.js`, `data/library/*`).
2. Rules: `romaji`, `review`, `words`, `kanji`; kana modules ported to ES modules.
3. Storage v2, library loader, service worker (app cache + library cache).
4. UI: shell + tabs, kana port, words (list, form, view), review screen, kanji library + card, settings/backup.
5. Tests: `tools/selftest.*`, `tools/browser-smoke.*`, `tools/check.py`; screenshots at phone and tablet sizes.
6. Docs: AGENTS.md, README, memory bank, code index; platform-repo references to the old folder name.
7. Sentences tab (P13): `js/sentences/sentences.js` rules, storage `sentences`, `sentences-ui` + `css/sentences.css`, selftest + smoke + scenes, docs. Done 2026-11-02.
8. Kanji card layout and "In your sentences" (P14): `kanji.sentencesUsing`, `kanji-card`, `css/kanji.css`, selftest + smoke + scene, docs. Done 2026-11-03 (selftest 152/152, smoke 98/98).
