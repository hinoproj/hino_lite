# [MODULE] build-library | Build the kanji library files the app downloads, plus the always-shipped kanji index
# [IFACE] layer: tooling | in: <data>/kanji_library.json, <data>/vocabulary/<level>.json, <data>/strokes/*.svg -> out: data/library/<level>.json + .strokes.json, js/kanji/kanji-index.js | crosses: [filesystem]
# [GRAPH] needs: [] | feeds: [] | group: tooling
# [STATE] stateless | persists: overwrites the generated files | raises: SystemExit on missing source data
# /// script
# requires-python = ">=3.11"
# ///
"""Build Hino Lite's kanji library from the platform repo's source rosters.

    uv run tools/build_library.py                # reads ../data (the platform repo's data/)
    uv run tools/build_library.py --data PATH    # any other copy of that folder

Output, per JLPT level (N5, N4, N3, N2, N1, none):
  data/library/<level>.json          kanji detail + example words (frequency rank < 11,000)
  data/library/<level>.strokes.json  stroke-order SVG per kanji, slimmed, stroke colour = currentColor
and js/kanji/kanji-index.js: every kanji's meaning, level and search terms (always shipped with the
app, so a saved word can join the kanji list before the library is downloaded), the level file list
and LIBRARY.version -- a hash of the level files, which names the browser cache they live in.
Rerun after the source rosters change, then commit the output.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
FREQ_MAX = 11000          # example words kept per kanji: frequency rank below this
MISSING_BAND = 9999       # kanji with no frequency band sort last (as in JLPT_coach)
LEVELS = ("N5", "N4", "N3", "N2", "N1", "none")
LEVEL_LABELS = {"N5": "N5", "N4": "N4", "N3": "N3", "N2": "N2", "N1": "N1", "none": "No level"}
PAREN_RE = re.compile(r"\([^)]*\)")
SVG_DROP_ATTRS = re.compile(
    r'\s(?:id|type|element|original|radical|position|part|number|variant|partial|tradForm|radicalForm|phon)="[^"]*"')


def level_of(raw: str | None) -> str:
    value = (raw or "").strip().upper()
    return value if value in LEVELS else "none"


def clean_terms(values) -> list:
    out, seen = [], set()
    for value in values:
        term = " ".join(PAREN_RE.sub(" ", str(value)).split()).strip(" .,;").lower()
        if term and term not in seen:
            seen.add(term)
            out.append(term)
    return out


def slim_svg(text: str) -> str:
    text = re.sub(r"<\?xml[^>]*\?>", "", text)
    text = re.sub(r"<!DOCTYPE[^\[>]*(\[.*?\])?\s*>", "", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = SVG_DROP_ATTRS.sub("", text)
    text = re.sub(r'\s(width|height)="[^"]*"', "", text, count=2)
    text = text.replace("stroke:#000000", "stroke:currentColor")
    text = re.sub(r">\s+<", "><", text)
    return " ".join(text.split())


def word_tuple(w: dict) -> list:
    gloss = "; ".join(p.strip() for p in (w.get("word_meaning") or "").split(";") if p.strip())
    return [w["word"], w.get("reading") or "", gloss, w.get("frequency_rank"),
            w.get("pitch_accent") or [], w.get("detailed_meanings") or []]


def integral_rank(entry: dict, n_words: int) -> float:
    band = entry.get("frequency_band")
    return (entry.get("difficulty_level") or 0) + (MISSING_BAND if band is None else band) + (
        100 / n_words if n_words else 100)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        print(f"[build_library.py][load_json] cannot read {path}: {err}", file=sys.stderr)
        raise SystemExit(1)


def build(data_dir: Path) -> None:
    library = load_json(data_dir / "kanji_library.json")
    shards: dict = {}
    levels: dict = {lv: [] for lv in LEVELS}

    for kanji, entry in library.items():
        raw_level = entry.get("jlpt_level") or "unknown"
        if raw_level not in shards:
            shard_path = data_dir / "vocabulary" / f"{raw_level}.json"
            shards[raw_level] = load_json(shard_path) if shard_path.is_file() else {}
        words = sorted((w for w in shards[raw_level].get(kanji, [])
                        if (w.get("frequency_rank") or FREQ_MAX) < FREQ_MAX),
                       key=lambda w: w["frequency_rank"])
        readings = entry.get("readings") or {}
        self_glosses = [t for w in words if w["word"] == kanji
                        for t in (w.get("word_meaning") or "").split(";")]
        detail = {
            "m": entry.get("kanji_meaning") or "",
            "alt": entry.get("alternative_meanings") or [],
            "on": readings.get("onyomi") or [],
            "kun": readings.get("kunyomi") or [],
            # Direct parts: [glyph, meaning, the kanji a tap opens or None]. The card shows no radical.
            "comp": [[c["character"], c.get("meaning") or "", c.get("link")] for c in entry.get("components") or []],
            "band": entry.get("frequency_band"),
            "words": [word_tuple(w) for w in words],
        }
        terms = [t for t in clean_terms(detail["alt"] + self_glosses) if t != detail["m"].lower()]
        svg_path = data_dir / "strokes" / (entry.get("strokes_svg") or "")
        svg = slim_svg(svg_path.read_text(encoding="utf-8")) if entry.get("strokes_svg") and svg_path.is_file() else None
        levels[level_of(raw_level)].append({
            "kanji": kanji, "detail": detail, "svg": svg,
            "rank": integral_rank(entry, len(words)),
            "index": [detail["m"], level_of(raw_level), "|".join(terms), " ".join(detail["on"] + detail["kun"])],
        })

    out_dir = APP_ROOT / "data" / "library"
    out_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    index, files = {}, []
    for lv in LEVELS:
        rows = sorted(levels[lv], key=lambda r: r["rank"])
        data_text = json.dumps({r["kanji"]: r["detail"] for r in rows}, ensure_ascii=False, separators=(",", ":"))
        strokes_text = json.dumps({r["kanji"]: r["svg"] for r in rows if r["svg"]},
                                  ensure_ascii=False, separators=(",", ":"))
        (out_dir / f"{lv}.json").write_text(data_text, encoding="utf-8")
        (out_dir / f"{lv}.strokes.json").write_text(strokes_text, encoding="utf-8")
        digest.update(data_text.encode("utf-8"))
        digest.update(strokes_text.encode("utf-8"))
        files.append({"id": lv, "label": LEVEL_LABELS[lv], "count": len(rows),
                      "data": f"data/library/{lv}.json", "strokes": f"data/library/{lv}.strokes.json",
                      "bytes": len(data_text.encode("utf-8")) + len(strokes_text.encode("utf-8"))})
        for r in rows:
            index[r["kanji"]] = r["index"]
        print(f"{lv:5} {len(rows):5} kanji  {files[-1]['bytes'] / 1e6:5.2f} MB")

    meta = {"version": digest.hexdigest()[:10], "levels": files}
    module = (
        "// [MODULE] kanji-index | GENERATED by tools/build_library.py -- do not edit: every library kanji's meaning, level, search terms\n"
        "// [IFACE] layer: data | in: nothing (static tables) -> out: LIBRARY {version, levels}, KANJI_INDEX {kanji: [meaning, level, terms, readings]} | crosses: []\n"
        "// [GRAPH] needs: [] | feeds: [kanji, library, selftest] | group: data\n"
        "// [STATE] stateless | persists: nothing | raises: nothing\n\n"
        f"export const LIBRARY = {json.dumps(meta, ensure_ascii=False)};\n\n"
        "// kanji -> [meaning, level, extra search terms joined by '|', on+kun readings joined by ' ']\n"
        "// Key order is level order, then integral rank within a level (easier and more useful first).\n"
        f"export const KANJI_INDEX = {json.dumps(index, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    (APP_ROOT / "js" / "kanji" / "kanji-index.js").write_text(module, encoding="utf-8")
    print(f"index {len(index)} kanji  {len(module.encode('utf-8')) / 1e3:.0f} KB  version {meta['version']}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data", type=Path, default=APP_ROOT.parent / "data",
                        help="the platform repo's data/ folder (default: ../data)")
    args = parser.parse_args()
    if not (args.data / "kanji_library.json").is_file():
        print(f"[build_library.py][main] no kanji_library.json under {args.data}", file=sys.stderr)
        raise SystemExit(1)
    (APP_ROOT / "js" / "kanji").mkdir(parents=True, exist_ok=True)
    build(args.data)


if __name__ == "__main__":
    main()
