// [MODULE] romaji | Pure rōmaji -> kana conversion (wāpuro / Hepburn / Nihon-shiki), hiragana <-> katakana, kana checks
// [IFACE] layer: domain | in: free text -> out: hiragana / katakana strings, booleans | crosses: []
// [GRAPH] needs: [] | feeds: [words, words-ui, sentences, sentences-ui, kanji, selftest] | group: domain
// [STATE] stateless | persists: nothing | raises: nothing

/**
 * The reading field stores kana only, but a child on a phone often types
 * rōmaji. These functions turn any Latin runs in a string into kana and leave
 * everything else (kana already typed with a Japanese keyboard) as it is.
 *
 * Rules, as an IME applies them:
 *   - longest match first: "sha" before "sh"/"s"
 *   - a doubled consonant is a small っ ("kitte"), "tch" too ("matcha")
 *   - "n" is ん before a consonant or at the end; "nn" is ん; "n'" is ん;
 *     "nn" + vowel reads as ん + な-row ("konnichiha" -> こんにちは)
 *   - "-" is the long-vowel mark ー
 *   - , . ! ? ~ become 、 。 ！ ？ 〜, and spaces next to that punctuation go
 *     ("jaa, mata" -> じゃあ、また)
 * Letters that match nothing stay Latin, so callers can tell the conversion
 * was incomplete (hasLatin).
 */

const TABLE = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご', gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  sha: 'しゃ', shu: 'しゅ', she: 'しぇ', sho: 'しょ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ja: 'じゃ', ju: 'じゅ', je: 'じぇ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  cha: 'ちゃ', chu: 'ちゅ', che: 'ちぇ', cho: 'ちょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
  tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ', thi: 'てぃ', thu: 'てゅ', twu: 'とぅ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど', dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
  dhi: 'でぃ', dhu: 'でゅ', dwu: 'どぅ',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ', hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', fyu: 'ふゅ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ', pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  ya: 'や', yu: 'ゆ', ye: 'いぇ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ', xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ',
  ltu: 'っ', xtu: 'っ', ltsu: 'っ', xtsu: 'っ', lwa: 'ゎ', xwa: 'ゎ',
  wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  '-': 'ー'
};

const PUNCTUATION = { ',': '、', '.': '。', '!': '！', '?': '？', '~': '〜' };

const MAX_KEY = 4;
const VOWELS = 'aiueo';

function isLetter(ch) {
  return ch >= 'a' && ch <= 'z';
}

/** Convert every Latin run in `text` to hiragana; kana and other characters pass through. */
export function toHiragana(text) {
  const original = String(text || '');
  const src = original.toLowerCase();
  // Lower-casing can change the length of a few exotic characters; then keep the lowered copy.
  const keep = src.length === original.length ? original : src;
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1] || '';

    if (ch === 'n' && !isLetter(next)) {
      // "n'" is an explicit ん; a bare final n is ん too.
      out += 'ん';
      i += next === "'" ? 2 : 1;
      continue;
    }
    if (ch === 'n' && next === 'n') {
      const after = src[i + 2] || '';
      // "nna" is ん + な; "nn" before anything else is a typed ん.
      out += 'ん';
      i += VOWELS.includes(after) || after === 'y' ? 1 : 2;
      continue;
    }
    if (ch === 'n' && !VOWELS.includes(next) && next !== 'y') {
      out += 'ん';
      i += 1;
      continue;
    }
    if (isLetter(ch) && !VOWELS.includes(ch) && (ch === next || (ch === 't' && next === 'c'))) {
      out += 'っ';
      i += 1;
      continue;
    }

    if (PUNCTUATION[ch]) {
      out += PUNCTUATION[ch];
      i += 1;
      continue;
    }

    let matched = false;
    for (let len = MAX_KEY; len > 0; len--) {
      const piece = src.slice(i, i + len);
      if (TABLE[piece]) {
        out += TABLE[piece];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += keep[i];      // keep the original character (case included)
      i += 1;
    }
  }
  // Japanese text puts no space around 、。！？ — "jaa, mata" -> じゃあ、また.
  return out.replace(/ *([、。！？]) */g, '$1');
}

/** Hiragana -> katakana, codepoint by codepoint; everything else unchanged. */
export function hiraganaToKatakana(text) {
  return Array.from(String(text || '')).map((ch) => {
    const code = ch.codePointAt(0);
    return code >= 0x3041 && code <= 0x3096 ? String.fromCodePoint(code + 0x60) : ch;
  }).join('');
}

/** Katakana -> hiragana, for comparing readings regardless of script. */
export function katakanaToHiragana(text) {
  return Array.from(String(text || '')).map((ch) => {
    const code = ch.codePointAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }).join('');
}

export function toKatakana(text) {
  return hiraganaToKatakana(toHiragana(text));
}

/** True when the text still holds Latin letters (an unfinished or impossible conversion). */
export function hasLatin(text) {
  return /[a-z]/i.test(String(text || ''));
}

/** Kana-only: hiragana, katakana, ー, ・, 〜, Japanese punctuation and spaces — at least one kana. */
export function isKana(text) {
  const value = String(text || '');
  return /^[ぁ-ゖゝゞァ-ヺー-ヾ・〜、。！？「」『』… ]+$/.test(value) && /[ぁ-ゖァ-ヺ]/.test(value);
}
