# Current task — Hino Lite: words, kanji library, kanji list (2026-11-01)

**Status:** built and verified 2026-11-01 (`uv run tools/check.py`: selftest 117/117, smoke 71/71;
screenshots at phone and tablet sizes reviewed). Folder renamed and pushed to Pages
2026-11-02 (`https://hinoproj.github.io/hino_lite/`). Open: a session on the real devices.

Extends the kana drill into **Hino Lite**: kana + the learner's own words + a kanji library whose
kanji join a personal list automatically. Learner: the owner's son, on a phone (portrait) and a
tablet (landscape), offline, on-device storage only. Existing progress may be dropped.

## Decisions (owner, 2026-11-01)

| # | Decision |
|---|----------|
| P1 | Name **Hino Lite**, folder `hino_lite/`, repo `hinoproj/hino_lite` (public, GitHub Pages from `main` root). |
| P2 | Keep kana_srs's look and its Dark / Light / Kids themes. Kana drill unchanged. |
| P3 | Word card: kanji writing (optional), reading (kana only — rōmaji typed is offered as hiragana / katakana suggestions), meaning (any text), example (any text), notes (any text). One flat list, no import. |
| P4 | Word review, two modes with separate scores, no gates. **Japanese → meaning**: writing → reading → meaning + rest (no writing: reading → meaning + rest). **Meaning → Japanese**: meaning → reading → writing + rest. Main button reveals the next step, "Show all" is a shortcut, tapping the card = main button. No audio. |
| P5 | Rating: four self-rating buttons — Didn't know / Guessed / Knew it / Easy! — on JLPT_coach's kanji scale (first answer from 3, learned 5, confident 15, a miss on a learned card drops to 4, cap 30). "Which one do I press?" help never shows points. D56 labels: unseen · unknown · learning · learned · confident. |
| P6 | Run: 10/15/20 cards; ≤5 new (newest first, a hard cap), ≤3 learned/confident for maintenance (stale ones more likely), the rest in-progress cards, stalest first; when short, backfill with more learned/confident only — so a fresh list gives a 5-card first run. Same rule for words and kanji. |
| P7 | Kanji from a word's writing join the kanji list if they are library kanji (々 skipped). Nothing leaves automatically; "Remove from my kanji" (confirmed) hides it and keeps its progress. "Mark as known" sets learned in both modes. Manual "+ Add to my kanji" from the library. |
| P8 | Kanji library: all 2,099 kanji, grouped by JLPT level (N5…N1, no level), downloaded on first Kanji-tab open, one file pair per level (data + strokes), N5 first. Card = JLPT_coach's (strokes, readings, radicals/components, example words with pitch accent) + "In your words", state, actions, "+ Add to my words". |
| P9 | Kanji review: two modes — **Kanji → meaning** and **Meaning → kanji** — same reveal pattern and ratings. |
| P10 | Bottom tabs Kana · Words · Kanji · Settings. One backup file for everything; reminder when unsaved changes are older than 7 days. Old kana_srs backups are refused. |
| P11 | ES modules, no `file://` support, no Node: rule tests and the UI smoke run in the browser, driven by `uv run tools/check.py`. User data in `localStorage` (`hino_lite_v2`) + `navigator.storage.persist()`. |
| P12 | Library files built by `tools/build_library.py` (uv, stdlib) from the platform repo's `data/`; output committed here. |

## Tasks

1. Build script + generated library (`js/kanji/kanji-index.js`, `data/library/*`).
2. Rules: `romaji`, `review`, `words`, `kanji`; kana modules ported to ES modules.
3. Storage v2, library loader, service worker (app cache + library cache).
4. UI: shell + tabs, kana port, words (list, form, view), review screen, kanji library + card, settings/backup.
5. Tests: `tools/selftest.*`, `tools/browser-smoke.*`, `tools/check.py`; screenshots at phone and tablet sizes.
6. Docs: AGENTS.md, README, memory bank, code index; platform-repo references to the old folder name.
