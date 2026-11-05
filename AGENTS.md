# AGENTS.md — Hino Lite (root)

Binding local contract for this repository. Read this before editing anything here.

## Bootstrap

- Project context: `.memory_bank/` — `projectbrief.md`, `technical_context.md`, `progress_context.md`
- Module graph, boundary map, group registry: `.agentic_docs/code_index.md` (**authoritative** —
  it wins over this file on any conflict about module names, edges or groups)
- Current build step and the owner's decisions (P1–P14): `.agentic_docs/current_task.md`
- Per-file 4-line headers (`[MODULE]`/`[IFACE]`/`[GRAPH]`/`[STATE]`) sit at the top of every
  source file, including `index.html`, the stylesheets and the tools

This repo is small enough to have no child `AGENTS.md`. If a directory grows its own conventions,
add one and register it in the Child Index below.

## Local contracts

1. **No build step for the app, no Node anywhere.** The browser loads exactly the files in the
   repo; no bundler, no `package.json`. Tooling is Python run with `uv` (stdlib only, PEP 723
   headers): `tools/build_library.py` and `tools/check.py`. The only generated sources are the
   library outputs (`js/kanji/kanji-index.js`, `data/library/*`) — never edit them by hand.
2. **ES modules, served over http(s) only.** `file://` is not supported (the kanji library needs
   the Cache API and a service worker). Locally, serve with `uv run tools/check.py serve` — it sets
   JavaScript MIME types that a Windows registry may get wrong for `python -m http.server`.
3. **Layer split is hard**: data (`kana-data`, `kanji-index`) → rules (`romaji`, `kana-srs`,
   `review`, `words`, `sentences`, `kanji`) → UI (`*-ui`, `kanji-card`, `shell`, `dom`, `theme`, `backup`).
   Rule modules never touch the DOM, storage or network; UI modules contain no scoring, run,
   reveal-order or validation rule. A new rule gets a `tools/selftest.js` assertion in the same change.
4. **One owner per storage**: `js/core/storage.js` is the only module that touches `localStorage`
   (every access guarded; the app runs in memory when storage is refused). `js/kanji/library.js` is
   the only page code that touches the library cache; `sw.js` owns the app cache and never deletes
   a `hino-lite-library-*` bucket.
5. **Never break the backup format silently.** `hino_lite` v2 (`STORAGE_KEY` `hino_lite_v2`) is the
   learner's only durable copy of hand-typed words and sentences. A shape change needs a new version and a migration
   in `normalize()`; a purely additive field that `normalize()` defaults may stay under v2.
   `normalize()` keeps keys it does not know (top level, settings, each word and sentence) and a
   save from another tab replaces the in-memory copy: an older copy of the app must never strip
   or overwrite what a newer one saved — keep both when editing `storage.js`. Review
   track ids (`words.read`, `words.recall`, `kanji.read`, `kanji.recall`) and kana mode ids are
   storage keys — renaming one orphans its scores.
6. **Bump `CACHE_NAME` in `sw.js`** in any change that touches a file in its `ASSETS` list, and add
   every new shipped file to that list. Cache-first never revalidates, so skipping either ships
   nothing (or a broken app) to installed devices. The library has its own version (from the build).
7. **Learner text is text.** Anything the learner typed reaches the DOM through `textContent`
   (`dom.h` text children); `html:` is reserved for markup we generate (stroke SVGs, pitch diagrams).
8. **Japanese text carries `lang="ja"`** (`dom.ja`), or phones in another language draw kanji in
   their Chinese shapes.
9. **The rating help never shows points** (`review-ui.js` `openHelp`): it describes what answering
   feels like. Learners who know the maths rate for points.
10. **Tests before "done".** `uv run tools/check.py` must end `ALL CHECKS PASSED`. Any change to
    screens, flows or persistence extends `tools/browser-smoke.js`.
11. Error/warning logs use the format `[<filename>][<functionName>] <message>: <error>`.
12. **Commits are the owner's.** Never commit without the go-ahead.

## Cross-cutting relations

| Change this | Must co-edit | Why |
| --- | --- | --- |
| Any file in `sw.js` `ASSETS`, or a new shipped file | `sw.js` (`CACHE_NAME`, `ASSETS`) | Installed copies otherwise keep the old bundle, or fail to precache. |
| `tools/build_library.py` output shape (level-file fields, index row) | `js/kanji/library.js`, `js/kanji/kanji.js` (`indexEntry`), `js/kanji/kanji-card.js`, `js/kanji/kanji-ui.js` | They read the generated tuples by position (`words: [word, reading, gloss, rank, pitch, senses]`). |
| `js/kana/kana-data.js` deck ids, item shape or `SHAPE_WEIGHT` | `js/kana/kana-srs.js`, `tools/selftest.js` | `kana-srs` reads `item.r`/`pr`/`consonant`/`vowel`; the selftest asserts deck sizes and parity. |
| Kana mode ids or `MODE_INFO` in `js/kana/kana-srs.js` | `js/kana/kana-ui.js`, saved data | Mode ids are keys of `state.kana`. |
| Kana scoring constants or `MISS_LIMIT` | `index.html` Settings (Kana scoring, Kana mistakes), `README.md` | The rules are printed to the learner. |
| Review constants in `js/review/review.js` (ratings, thresholds, `MAX_NEW_PER_RUN`, maintenance) | `index.html` Settings "Words and kanji reviews", `README.md`, `tools/selftest.js` | The run rule is described to the learner (points are not). |
| Reveal order (`words.cardPlan`, `kanji.cardPlan`) or field names | `js/words/words-ui.js` / `js/kanji/kanji-ui.js` part renderers, `README.md` | Adapters render the keys the plans name. |
| `THEMES` in `js/core/storage.js` | `css/app.css` `:root[data-theme=…]`, `js/core/theme.js` `THEME_BAR_COLOR`, `js/settings/settings-ui.js` labels | A theme id is the palette key, the status-bar colour key and a button label. |
| Element ids in `index.html` | `js/kana/kana-ui.js` `cacheDom()`/`initKana()`, `js/settings/settings-ui.js`, `js/core/shell.js`, the `screen-*` ids the `*-ui.js` modules fill | Modules bind static nodes by id. |
| Tabs (`TABS` in `js/core/shell.js`) | `index.html` tab-bar buttons (`data-tab`) and `screen-<tab>` sections, `js/main.js` `registerTab`, `css/app.css` `.tabbar` column count, the tab count in `tools/browser-smoke.js` | A tab is a route, a button, a screen and a grid column; one missing piece leaves a dead button or a misaligned bar. |
| Ids and classes the smoke test drives (`#btn-*`, `.mode-row[data-track]`, `.rating.*`, `.kanji-tile[data-kanji]`, `.rc-link[data-kanji]`, `.progress-panel .track`, `.word-row[data-id]`, `#word-view .word-hero`, `.word-fields`, `.card-sentence`, `#sentence-*`, `.prompt-row[data-status]` `.pw-*`) | `tools/browser-smoke.js`, `tools/scene.html` | The UI check finds the app through them. |

## Verification

```bash
uv run tools/check.py            # rule selftest + UI smoke test in headless Chrome/Edge
uv run tools/check.py serve      # dev server, then open http://127.0.0.1:8000/
uv run tools/check.py shots OUT  # screenshots at phone (390×844) and tablet (1280×800) sizes
```

The smoke test erases `hino_lite_v2` and the library cache in the browser profile it runs in;
`check.py` always uses a throwaway profile. Never open `tools/browser-smoke.html` or
`tools/scene.html` in a browser that holds real progress.

## Child Index

_None._ Add child `AGENTS.md` files here if a subdirectory grows its own conventions.
