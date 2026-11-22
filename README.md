# Hino Lite

An offline study app for a phone or a tablet: kana drills, your own word and sentence lists, and a kanji
library whose kanji join your list by themselves. Static files, no server, no build step —
installed from GitHub Pages, everything stays on the device.

## Tabs

**Kana** — the six hiragana/katakana decks with timed multiple choice and typing (below).

**Words** — your words. Each has a kanji writing (optional), a reading (kana — type rōmaji and
tap the hiragana or katakana suggestion), a meaning, notes and an example (any text). Paste a
word given one field per line into the **Kanji** field and the form fills itself:

```
少し
すこし
• a little • a small amount • slightly
An adverb or noun indicating a small quantity or degree.
少し待ってください。 - Please wait a little.
```

The first line is the writing (a kana word repeats its kana there, and is saved without a writing),
then the reading with its accent mark and the meaning; the last line becomes the example (the
sentence and its translation on one line, or dashes only — `-`, `---` — for no example), and any
line between the meaning and the last becomes the notes. An older kana block that starts with its
reading still works.
**Undo** puts the form back as it was before the paste.

The reading may carry its pitch accent: `[きょ]う` marks the accented mora, `とけい [flat]` says there
is none, and a reading without brackets means the accent is not known. The accented mora shows in
**bold** wherever the word's reading appears (it is the accent nucleus: the voice is high there and
falls right after it). A flat word shows a **FLAT** label instead; hover it, or tap it on the word
sheet, for what flat means. A reading whose accent is not known shows neither. Type the same
notation in the Reading field (rōmaji works: `[kyo]u`); a word being edited shows its accent that way.

Two reviews, each with its own progress:

| Review | Shows | Main button reveals |
| --- | --- | --- |
| Japanese → meaning | the kanji writing (or the reading when there is none) | reading → meaning (notes and example folded) |
| Meaning → Japanese | the meaning | reading → kanji writing (notes and example folded) |

"Show all" reveals everything at once; tapping the card works like the main button. Notes and
example come folded under one **Notes & example** toggle at the bottom of the card; tap it to
open them (every new card starts folded). Then rate
yourself: **Didn't know**, **Guessed**, **Knew it** or **Easy!** ("Which one do I press?" explains).
A word's card shows how far each review has come; **Mark as known** puts a word you already know
straight to learned in both, so it comes up only now and then. The list is grouped by progress,
least known first: **New** (never reviewed), **Learning**, **Learned** and **Confident** (a word
reaches these only when both reviews have). Above them, **Least known** repeats every word you
didn't know in either review, the longest-unknown first, so you can find them in one place.

**Sentences** — your sentences: the sentence, its reading (optional, kana), a translation and
notes. Paste a sentence with readings in brackets and its translation at the end, and **Parse**
sorts it into the fields:

```
質問（しつもん）を聞いて（きいて）もいいですか。 — May I ask a question?
```

A bracket — `()`, `[]` or their full-width forms — is the reading of the kanji word right before
it (a particle in front is left out, お/ご are kept). The Latin or Cyrillic text at the end becomes
the translation, with or without a `—`, `-` or `:` before it. **Undo** puts the pasted text back.

Paste several lines and the form fills at once, no Parse needed: the first line is the sentence
(its bracketed readings read as above), the second the translation, the rest the notes. **Undo**
then puts the form back as it was before the paste.

```
もう少(すこ)し、ゆっくり言(い)ってください
Please speak a little more slowly
Combines もう少し (a little more), ゆっくり (slowly), and 言ってください (…).
```

Saving a sentence, new or edited, adds its kanji to your kanji list (one you removed stays
removed). After you save a new sentence, its kanji words are offered as word cards: bracketed words come
with their reading, other kanji with an empty one. Type a meaning (for a conjugated word, add its
dictionary form: "listen — て-form of 聞く"), open **+ Notes** if you want to add any, and tap
**Add**; the card gets the sentence and its
translation as its example, and its kanji join your kanji list. Words already in your list are
marked. Deleting a sentence keeps its word cards (its progress goes with it).

Two sentence reviews, each with its own progress, for every sentence that has a translation:

| Review | Shows | Main button reveals |
| --- | --- | --- |
| Japanese → translation | the sentence | reading (when it has kanji) → translation, notes |
| Translation → Japanese | the translation | sentence, reading, notes |

The rating, the run and **Mark as known** work as for words, and the list is grouped by progress
the same way.

**Kanji** — all 2,099 library kanji by JLPT level (N5…N1, no level), downloaded once on the first
visit (~6.7 MB on the device). Kanji in your words' writing join *your* list automatically; you can
also add any kanji, remove one (its progress is kept), or mark it as known. The card shows how far
along the kanji is in each review, stroke order, readings with components, your own
words and sentences that use it, and example words with pitch accent (one tap adds a word to your
list). Two reviews, each with its own progress:

| Review | Shows | Main button reveals |
| --- | --- | --- |
| Kanji → meaning | the kanji | meaning → readings, stroke order, components, your words and sentences |
| Meaning → kanji | the meaning | the kanji beside its stroke order → readings, components, your words and sentences |

On a review card your words (up to 4) and sentences (up to 2) come with their reading and their
meaning or translation, since nothing on the card opens.

**Settings** — theme (Dark, Light, Kids), backup export/import, reset.

## Words and kanji reviews

A run (10, 15 or 20 cards) fills in strict order, each group before the next gets a seat:
**unknown** cards first (the ones you keep missing — they are in every run, the longest-waiting
first, until you get them), then **learning** cards (the ones you haven't seen for longest first).
Only if there is room left come **new** cards (newest first) and cards you already **know**
(rechecked so they stay fresh — ones you haven't seen for longest come up more often, confident
ones rarely), taking turns: up to 5 new, up to 3 known, more new, then more known. A run never
holds more than 10 new cards. With more unknown cards than a run holds, the same longest-waiting
ones repeat each run until they move up. Progress labels: unseen · unknown ·
learning · learned · confident.

Every review card (words, kanji, sentences) shows where it stands as two columns of dots beside
the prompt, filling from the bottom: the left column fills up to **learned**, the right one up
to **confident**, in the colour of the card's label; a card never answered shows empty rings. The
dots show the card as it was before you answered and do not change when you rate it.

## Kana drill

| Deck | Kana | Modes |
| --- | --- | --- |
| Hiragana · basic / dakuten / yōon | 46 / 25 / 36 | Read, Recall, Type |
| Katakana · basic / dakuten / yōon | 46 / 25 / 36 | Read, Recall |

Read (kana → pick rōmaji), Recall (rōmaji → pick kana), Type (kana → type rōmaji). Multiple
choice: ≤3s **+5**, ≤5s **+3**, slower **+1**, wrong **−5**; typing **+3** / **−5**. Scores floor
at 0; learned at 10, confident at 25, per mode. A wrong pick comes back as an option the next time
that kana is asked (last 3 per kana and mode).

## Installing it

Open the GitHub Pages URL in Chrome on the device, then browser menu → *Add to Home screen*. The
app works offline from then on; open the Kanji tab once while online to download the library.

**Backups.** Everything lives in this browser on this device. Settings → *Export backup* writes a
JSON file; *Import backup* restores it. The app reminds you when changes have waited a week for a
backup. Backups from the old Kana SRS app cannot be loaded.

## Development

```
uv run tools/check.py            # selftest of the rules + UI smoke test (headless Chrome/Edge)
uv run tools/check.py serve      # http://127.0.0.1:8000/
uv run tools/check.py shots OUT  # screenshots, phone and tablet sizes
uv run tools/build_library.py    # rebuild the kanji library from ../data (the platform repo's data/)
```

No Node, no bundler, no package manager: the browser loads the files in the repo as ES modules.
After changing any file listed in `sw.js`, bump `CACHE_NAME` there.
