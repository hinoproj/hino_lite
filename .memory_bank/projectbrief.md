# Project Brief — Hino Lite

## What this is

A standalone, offline study app for a phone or a tablet: kana drills, the learner's own word
list with a two-way word review, a sentence list that feeds word cards, and a kanji library whose kanji join the learner's kanji list
by themselves, with a two-way kanji review. Static files, no server, no build step; everything
the learner does stays on the device. Formerly **Kana SRS** (kana only); renamed and extended on
2026-11-01.

## Who it is for, and why it exists

The learner is the owner's son, on an Android phone (portrait) and tablet (landscape). The app
is also the owner's **UX testbed** for the Hino Sensei platform's study-list flows on that form
factor (platform D66): capturing a word, reviewing it step by step, and kanji arriving in a list
on their own. It shares nothing with the platform at run time; findings move to the platform by hand.

## Scope

- **Kana**: six decks (hiragana/katakana × basic 46 / dakuten 25 / yōon 36); Read and Recall
  (timed multiple choice), Type (hiragana only); per-kana-per-mode scores; mistake replay.
- **Words**: the learner types a word — kanji writing (optional), reading (kana; rōmaji is offered
  as hiragana/katakana suggestions), meaning, example, notes (any text). One flat list. Two
  reviews with separate scores: Japanese → meaning and Meaning → Japanese, revealed step by step.
- **Kanji**: library of all 2,099 kanji grouped by JLPT level, downloaded once; library kanji in a
  word's writing join the kanji list; add any kanji, remove one (progress kept), mark as known.
  Card with stroke order, readings, radicals/components, example words with pitch accent and
  "add to my words". Two reviews: Kanji → meaning and Meaning → kanji.
- **Sentences** (from 2026-11-02): a list of the learner's sentences (sentence, optional reading,
  translation, notes). Pasted text with bracketed readings and a trailing translation is parsed
  into the fields; a new sentence's kanji words are offered as word cards with the sentence as
  their example. No sentence review yet.
- **Self-rating** for words and kanji: Didn't know / Guessed / Knew it / Easy!, on JLPT_coach's
  kanji scale; runs of 10/15/20 with at most 5 new cards.
- One JSON backup file for everything; reminder after a week of unsaved changes.

## Requirements that shaped the design

1. **Offline on a phone and a tablet**, installed as a PWA from GitHub Pages
   (`hinoproj/hino_lite`, public, Pages from `main` root).
2. **No build step, no Node**: the browser loads the repo's files as ES modules; tooling is
   Python run with `uv`.
3. **The learner's typed words are irreplaceable** — guarded storage, explicit backup, confirmed
   deletes, a versioned backup format.
4. **A child uses it**: big targets, plain words, the rating help describes feelings not points,
   the Kids theme cheers.

## Out of scope

- Sentence SRS and Sentence Coach — later (the sentence list exists)
- Audio, handwriting recognition, typing answers for words/kanji
- Import of word lists, tags/sets, sync, accounts, any server
- Old Kana SRS backups (this version starts fresh)
