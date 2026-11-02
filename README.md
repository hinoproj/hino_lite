# Hino Lite

An offline study app for a phone or a tablet: kana drills, your own word list, and a kanji
library whose kanji join your list by themselves. Static files, no server, no build step —
installed from GitHub Pages, everything stays on the device.

## Tabs

**Kana** — the six hiragana/katakana decks with timed multiple choice and typing (below).

**Words** — your words. Each has a kanji writing (optional), a reading (kana — type rōmaji and
tap the hiragana or katakana suggestion), a meaning, an example and notes (any text). Two reviews,
each with its own progress:

| Review | Shows | Main button reveals |
| --- | --- | --- |
| Japanese → meaning | the kanji writing (or the reading when there is none) | reading → meaning, example, notes |
| Meaning → Japanese | the meaning | reading → kanji writing, example, notes |

"Show all" reveals everything at once; tapping the card works like the main button. Then rate
yourself: **Didn't know**, **Guessed**, **Knew it** or **Easy!** ("Which one do I press?" explains).

**Kanji** — all 2,099 library kanji by JLPT level (N5…N1, no level), downloaded once on the first
visit (~6.7 MB on the device). Kanji in your words' writing join *your* list automatically; you can
also add any kanji, remove one (its progress is kept), or mark it as known. The card shows stroke
order, readings, radicals and components, example words with pitch accent (one tap adds a word to
your list), and your own words that use it. Two reviews: **Kanji → meaning** and **Meaning → kanji**.

**Settings** — theme (Dark, Light, Kids), backup export/import, reset.

## Words and kanji reviews

A run (10, 15 or 20 cards) holds at most 5 new cards (newest first), up to 3 you already know so
they stay fresh (ones you haven't seen for longest come up more often), and the cards you are
still learning. Progress labels: unseen · unknown · learning · learned · confident.

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
