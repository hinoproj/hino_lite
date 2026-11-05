// [MODULE] selftest | Browser-run assertions over the pure modules: kana tables and rules, rōmaji, review, words, sentences, kanji, storage normalize
// [IFACE] layer: tooling | in: nothing -> out: report in #out and POSTed to /__report, ending SELFTEST PASSED/FAILED | crosses: [browser DOM, local HTTP server]
// [GRAPH] needs: [kana-data, kana-srs, romaji, review, words, sentences, kanji, kanji-index, storage] | feeds: [selftest-page] | group: tooling
// [STATE] stateless | persists: nothing | raises: nothing

/**
 * The modules under test are the files the app ships, imported as they are:
 * no build step and no Node. tools/check.py opens this page in headless
 * Chrome and reads the report it POSTs back.
 */

import { KANA_DATA as DATA } from '../js/kana/kana-data.js';
import { KanaSRS as SRS } from '../js/kana/kana-srs.js';
import * as RJ from '../js/core/romaji.js';
import * as R from '../js/review/review.js';
import * as W from '../js/words/words.js';
import * as S from '../js/sentences/sentences.js';
import * as K from '../js/kanji/kanji.js';
import { LIBRARY, KANJI_INDEX } from '../js/kanji/kanji-index.js';
import { normalize } from '../js/core/storage.js';

const lines = [];
let failures = 0;

function check(name, condition, detail) {
  if (condition) lines.push('  ok   ' + name);
  else {
    failures += 1;
    lines.push('  FAIL ' + name + (detail ? ' -- ' + detail : ''));
  }
}

function section(title) {
  lines.push('', title);
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// --- Kana: deck tables ------------------------------------------------

section('Kana deck tables');

const EXPECTED_SIZES = {
  hira_basic: 46, hira_dakuten: 25, hira_yoon: 36,
  kata_basic: 46, kata_dakuten: 25, kata_yoon: 36
};
Object.keys(EXPECTED_SIZES).forEach((id) => {
  const deck = DATA.deckById[id];
  check(id + ' has ' + EXPECTED_SIZES[id] + ' kana', deck && deck.items.length === EXPECTED_SIZES[id],
    deck ? 'got ' + deck.items.length : 'deck missing');
});
const allKeys = [];
DATA.decks.forEach((d) => d.items.forEach((i) => allKeys.push(i.key)));
check('no kana appears twice across decks', new Set(allKeys).size === allKeys.length);
check('214 kana in total', allKeys.length === 214, 'got ' + allKeys.length);
check('every item accepts its own Hepburn spelling',
  DATA.decks.every((d) => d.items.every((i) => i.accept.indexOf(i.r) >= 0)));
check('katakana decks mirror hiragana romaji exactly',
  ['basic', 'dakuten', 'yoon'].every((kind) => {
    const hd = DATA.decks.find((d) => d.script === 'hiragana' && d.kind === kind);
    const kd = DATA.decks.find((d) => d.script === 'katakana' && d.kind === kind);
    return hd.items.length === kd.items.length &&
      hd.items.every((item, i) => item.r === kd.items[i].r && item.pr === kd.items[i].pr);
  }));
check('ji/zu homophones prompt distinctly',
  DATA.byKey['ぢ'].pr === 'di' && DATA.byKey['づ'].pr === 'du' && DATA.byKey['じ'].pr === 'ji' && DATA.byKey['ず'].pr === 'zu');
check('yoon inherit base-glyph confusion (じゃ vs ちゃ)', DATA.confusionWeight(DATA.byKey['じゃ'], DATA.byKey['ちゃ']) > 0);

// --- Kana: scoring and typing -------------------------------------------

section('Kana scoring');

check('MCQ correct under 3s is +5', SRS.pointsFor(SRS.MODE_MCQ_K2R, true, 2999) === 5);
check('MCQ correct at exactly 3s is +5', SRS.pointsFor(SRS.MODE_MCQ_K2R, true, 3000) === 5);
check('MCQ correct at 4s is +3', SRS.pointsFor(SRS.MODE_MCQ_R2K, true, 4000) === 3);
check('MCQ correct past 5s is +1', SRS.pointsFor(SRS.MODE_MCQ_K2R, true, 9000) === 1);
check('MCQ wrong is -5', SRS.pointsFor(SRS.MODE_MCQ_K2R, false, 1000) === -5);
check('typed correct is +3 regardless of time', SRS.pointsFor(SRS.MODE_TYPE, true, 60000) === 3);
check('typed wrong is -5', SRS.pointsFor(SRS.MODE_TYPE, false, 100) === -5);
check('score floors at 0', SRS.applyPoints(3, -5) === 0 && SRS.applyPoints(0, -5) === 0);
check('state boundaries', SRS.stateOf(0) === 'new' && SRS.stateOf(1) === 'learning' &&
  SRS.stateOf(9) === 'learning' && SRS.stateOf(10) === 'learned' &&
  SRS.stateOf(24) === 'learned' && SRS.stateOf(25) === 'confident');

check('Hepburn accepted', SRS.checkTyped('shi', DATA.byKey['し']));
check('Nihon-shiki accepted', SRS.checkTyped('si', DATA.byKey['し']));
check('case and padding ignored', SRS.checkTyped('  SHI ', DATA.byKey['し']));
check('wapuro yoon accepted', SRS.checkTyped('sya', DATA.byKey['しゃ']) && SRS.checkTyped('zyu', DATA.byKey['じゅ']));
check('du accepted for づ', SRS.checkTyped('du', DATA.byKey['づ']) && SRS.checkTyped('zu', DATA.byKey['づ']));
check('n variants accepted', SRS.checkTyped('nn', DATA.byKey['ん']) && SRS.checkTyped("n'", DATA.byKey['ん']));
check('wrong answer rejected', !SRS.checkTyped('sa', DATA.byKey['し']));
check('empty answer rejected', !SRS.checkTyped('   ', DATA.byKey['し']));

// --- Kana: runs and questions -------------------------------------------

section('Kana runs and questions');

const statsFrom = (scores) => (key) => ({ score: scores[key] || 0, lastSeen: 0 });
const deck = DATA.deckById.hira_basic;
const freshRun = SRS.buildRun(deck, statsFrom({}), 15);
check('fresh run has the requested size', freshRun.length === 15, 'got ' + freshRun.length);
check('fresh run is the first 15 kana in row order',
  freshRun.map((i) => i.index).sort((a, b) => a - b).join(',') === [...Array(15).keys()].join(','));
const mixed = {};
deck.items.slice(0, 8).forEach((i) => { mixed[i.key] = 12; });
deck.items.slice(8, 12).forEach((i) => { mixed[i.key] = 30; });
const mixedRun = SRS.buildRun(deck, statsFrom(mixed), 20);
const byState = { learned: 0, confident: 0, other: 0 };
mixedRun.forEach((item) => {
  const s = SRS.stateOf(mixed[item.key] || 0);
  if (s === 'learned') byState.learned += 1; else if (s === 'confident') byState.confident += 1; else byState.other += 1;
});
check('run size honoured with a mixed deck', mixedRun.length === 20);
check('at most 3 learned kana per run', byState.learned <= 3, 'got ' + byState.learned);
check('at most 1 confident kana per run', byState.confident <= 1, 'got ' + byState.confident);
check('no kana repeats within a run', new Set(mixedRun.map((i) => i.key)).size === mixedRun.length);
const mastered = {};
deck.items.forEach((i) => { mastered[i.key] = 30; });
check('a mastered deck still fills a full run', SRS.buildRun(deck, statsFrom(mastered), 20).length === 20);

const optionProblems = [];
DATA.decks.forEach((d) => {
  [SRS.MODE_MCQ_K2R, SRS.MODE_MCQ_R2K].forEach((mode) => {
    d.items.forEach((item) => {
      for (let trial = 0; trial < 10; trial++) {
        const qn = SRS.buildQuestion(item, d, mode);
        const texts = qn.options.map((o) => o.text);
        if (qn.options.length !== SRS.OPTION_COUNT) optionProblems.push(item.key + ' option count');
        if (qn.options.filter((o) => o.correct).length !== 1) optionProblems.push(item.key + ' correct count');
        if (new Set(texts).size !== texts.length) optionProblems.push(item.key + ' duplicate option');
      }
    });
  });
});
check('every MCQ question is well-formed in every deck', !optionProblems.length, optionProblems.slice(0, 5).join('; '));
check('type mode only offered on hiragana decks',
  SRS.modesForDeck(DATA.deckById.hira_basic).includes(SRS.MODE_TYPE) &&
  !SRS.modesForDeck(DATA.deckById.kata_basic).includes(SRS.MODE_TYPE));
let confusableHits = 0;
for (let i = 0; i < 400; i++) {
  if (SRS.buildQuestion(DATA.byKey['シ'], DATA.deckById.kata_basic, SRS.MODE_MCQ_K2R).options.some((o) => o.key === 'ツ')) confusableHits += 1;
}
check('confusable distractors are favoured (ツ against シ)', confusableHits / 400 > 0.4, 'rate ' + confusableHits / 400);
check('newest miss goes first', SRS.pushMiss(['a', 'b'], 'c').join() === 'c,a,b');
check('the oldest miss drops past the limit', SRS.pushMiss(['a', 'b', 'c'], 'd').join() === 'd,a,b');
let missesShown = true;
for (let trial = 0; trial < 20; trial++) {
  const keys = SRS.buildQuestion(DATA.byKey['シ'], DATA.deckById.kata_basic, SRS.MODE_MCQ_K2R, ['ツ', 'ソ', 'ン']).options.map((o) => o.key);
  if (!['ツ', 'ソ', 'ン'].every((k) => keys.includes(k))) missesShown = false;
}
check('every remembered miss is on screen', missesShown);

// --- Rōmaji -----------------------------------------------------------

section('Rōmaji to kana');

const hira = {
  benkyou: 'べんきょう', konnichiha: 'こんにちは', kitte: 'きって', matcha: 'まっちゃ',
  shinbun: 'しんぶん', "kan'i": 'かんい', tennou: 'てんのう', onna: 'おんな', gakkou: 'がっこう',
  'ra-men': 'らーめん', jyuu: 'じゅう', tsukue: 'つくえ', hon: 'ほん', sanpo: 'さんぽ',
  konnyaku: 'こんにゃく', "kin'youbi": 'きんようび', Tokyo: 'ときょ', fujisan: 'ふじさん', shi: 'し', si: 'し',
  tanin: 'たにん', 'Jaa, mata': 'じゃあ、また', 'hai!': 'はい！', 'nan desu ka?': 'なん です か？',
  'sou desu ne.': 'そう です ね。'
};
Object.entries(hira).forEach(([input, want]) => {
  check(input + ' -> ' + want, RJ.toHiragana(input) === want, 'got ' + RJ.toHiragana(input));
});
check('kana already typed passes through (たbeる -> たべる)', RJ.toHiragana('たbeる') === 'たべる');
check('terebi -> テレビ', RJ.toKatakana('terebi') === 'テレビ', RJ.toKatakana('terebi'));
check('ko-hi- -> コーヒー', RJ.toKatakana('ko-hi-') === 'コーヒー', RJ.toKatakana('ko-hi-'));
check('unconvertible letters stay Latin', RJ.hasLatin(RJ.toHiragana('qq')) && RJ.hasLatin(RJ.toHiragana('abc')));
check('isKana: hiragana, katakana, long mark', RJ.isKana('べんきょう') && RJ.isKana('テレビ') && RJ.isKana('コーヒー'));
check('isKana rejects rōmaji, kanji and empty', !RJ.isKana('benkyou') && !RJ.isKana('勉強') && !RJ.isKana(''));
check('isKana: Japanese punctuation, but not punctuation alone', RJ.isKana('じゃあ、また') && RJ.isKana('「はい」！') && !RJ.isKana('、。'));
check('katakana -> hiragana', RJ.katakanaToHiragana('テレビ') === 'てれび');

// --- Review rules -------------------------------------------------------

section('Review rules');

check('labels follow D56 thresholds',
  R.stateOf(-1) === 'unseen' && R.stateOf(0) === 'unknown' && R.stateOf(1) === 'learning' &&
  R.stateOf(4) === 'learning' && R.stateOf(5) === 'learned' && R.stateOf(14) === 'learned' &&
  R.stateOf(15) === 'confident');
check('first answer starts from 3: Easy! -> 5 (learned in one sighting)', R.applyRating(-1, R.RATING_EASY) === 5);
check('first answer: Knew it -> 4, Guessed -> 2, Didn\'t know -> 0',
  R.applyRating(-1, R.RATING_KNEW) === 4 && R.applyRating(-1, R.RATING_GUESSED) === 2 && R.applyRating(-1, R.RATING_MISSED) === 0);
check('a miss on a learned card drops it to 4', R.applyRating(10, R.RATING_MISSED) === 4 && R.applyRating(20, R.RATING_MISSED) === 4);
check('a guess on a learned card only erodes by one', R.applyRating(10, R.RATING_GUESSED) === 9);
check('a miss below learned subtracts 3, floor 0', R.applyRating(4, R.RATING_MISSED) === 1 && R.applyRating(0, R.RATING_MISSED) === 0);
check('score caps at 30', R.applyRating(29, R.RATING_EASY) === 30);
check('mark as known lifts to 5 but never lowers', R.knownScore(-1) === 5 && R.knownScore(2) === 5 && R.knownScore(20) === 20);
check('known means every direction at least learned', R.isKnown([5, 15]) && !R.isKnown([5, 4]) && !R.isKnown([-1, 20]) && !R.isKnown([]));
check('progress group: new only if never answered, learned/confident only if every direction is',
  R.progressGroup([-1, -1]) === 'unseen' && R.progressGroup([5, -1]) === 'learning' && R.progressGroup([0, 0]) === 'learning' &&
  R.progressGroup([5, 4]) === 'learning' && R.progressGroup([5, 20]) === 'learned' && R.progressGroup([15, 30]) === 'confident' &&
  R.PROGRESS_GROUPS.map((g) => g.id).join() === 'unseen,learning,learned,confident');
const grouped = R.groupByProgress(['a', 'b', 'c', 'd'], (id) => ({ a: [5, 5], b: [-1, -1], c: [5, 5], d: [2, -1] })[id]);
check('groupByProgress: least known first, empty groups left out, order kept inside a group',
  grouped.map((g) => g.id + ':' + g.items.join('')).join() === 'unseen:b,learning:d,learned:ac',
  grouped.map((g) => g.id + ':' + g.items.join('')).join());
check('ratings are four, lowest first', R.RATINGS.map((r) => r.value).join() === '-3,-1,1,2');

const items = (n, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: 'w' + (i + offset), addedAt: i + offset }));
const now = 100 * 86400000;
const unseenOnly = R.buildRun(items(20), () => ({ score: -1, lastSeen: 0 }), 10, { now, rng: seeded(1) });
check('only new cards: a run holds at most 5', unseenOnly.length === 5, 'got ' + unseenOnly.length);
check('new cards come newest first', unseenOnly.map((i) => i.id).sort().join() === ['w15', 'w16', 'w17', 'w18', 'w19'].sort().join(),
  unseenOnly.map((i) => i.id).join());

const pool = items(10, 0).concat(items(10, 10), items(10, 20));
const scoreOf = (id) => {
  const n = Number(id.slice(1));
  if (n < 10) return { score: 2, lastSeen: n * 86400000 };          // in progress, w0 stalest
  if (n < 20) return { score: 8, lastSeen: (n - 10) * 86400000 };   // learned
  return { score: -1, lastSeen: 0 };                               // new
};
const mixedWords = R.buildRun(pool, scoreOf, 15, { now, rng: seeded(2) });
const kinds = { fresh: 0, prog: 0, known: 0 };
mixedWords.forEach((i) => {
  const s = R.stateOf(scoreOf(i.id).score);
  if (s === 'unseen') kinds.fresh += 1; else if (s === 'learned') kinds.known += 1; else kinds.prog += 1;
});
check('mixed run: 5 new, 3 maintenance, 7 in progress',
  mixedWords.length === 15 && kinds.fresh === 5 && kinds.known === 3 && kinds.prog === 7, JSON.stringify(kinds));
check('in-progress cards are the stalest ones',
  mixedWords.filter((i) => Number(i.id.slice(1)) < 10).every((i) => Number(i.id.slice(1)) < 7));
check('no card twice in a run', new Set(mixedWords.map((i) => i.id)).size === mixedWords.length);

const knownOnly = R.buildRun(items(20), () => ({ score: 8, lastSeen: 0 }), 10, { now, rng: seeded(3) });
check('all learned: the run still fills from maintenance', knownOnly.length === 10, 'got ' + knownOnly.length);

let learnedPicks = 0;
let confidentPicks = 0;
const halves = items(20);
for (let t = 0; t < 300; t++) {
  R.buildRun(halves, (id) => ({ score: Number(id.slice(1)) < 10 ? 8 : 20, lastSeen: 0 }), 3, { now, rng: seeded(t + 10) })
    .forEach((i) => { if (Number(i.id.slice(1)) < 10) learnedPicks += 1; else confidentPicks += 1; });
}
check('confident cards come back far less often than learned ones', confidentPicks * 2 < learnedPicks,
  learnedPicks + ' learned vs ' + confidentPicks + ' confident');

// --- Words ----------------------------------------------------------------

section('Words');

const isLib = K.isLibraryKanji;
check('normalize turns leftover rōmaji into hiragana', W.normalizeDraft({ reading: ' benkyou ' }).reading === 'べんきょう');
check('reading and meaning are required',
  Object.keys(W.validate(W.normalizeDraft({ writing: '勉強' }))).sort().join() === 'meaning,reading');
check('a reading that is not kana is refused', Boolean(W.validate(W.normalizeDraft({ reading: 'abc', meaning: 'x' })).reading));
check('a valid kana-only word passes', !Object.keys(W.validate(W.normalizeDraft({ reading: 'terebi', meaning: 'TV' }))).length);
check('a phrase with punctuation passes (Jaa, mata)', !Object.keys(W.validate(W.normalizeDraft({ reading: 'Jaa, mata', meaning: 'See you' }))).length);
check('extractKanji: library kanji in order, once', W.extractKanji('勉強する勉', isLib).join('') === '勉強');
check('extractKanji skips 々', W.extractKanji('日々', isLib).join('') === '日');
check('extractKanji skips kanji outside the library', W.extractKanji('𠀋学', isLib).join('') === '学');
check('extractKanji of a kana word is empty', W.extractKanji('テレビ', isLib).length === 0);
const full = { writing: '勉強', reading: 'べんきょう', meaning: 'study', example: '毎日勉強します。', notes: '' };
const bare = { writing: '', reading: 'テレビ', meaning: 'TV', example: '', notes: 'loanword' };
const steps = (plan) => plan.prompt + ' | ' + plan.steps.map((s) => s.keys.join(',')).join(' | ');
check('Japanese → meaning with kanji', steps(W.cardPlan(full, W.TRACK_READ)) === 'writing | reading | meaning,example', steps(W.cardPlan(full, W.TRACK_READ)));
check('Japanese → meaning without kanji', steps(W.cardPlan(bare, W.TRACK_READ)) === 'reading | meaning,notes', steps(W.cardPlan(bare, W.TRACK_READ)));
check('Meaning → Japanese with kanji', steps(W.cardPlan(full, W.TRACK_RECALL)) === 'meaning | reading | writing,example', steps(W.cardPlan(full, W.TRACK_RECALL)));
check('Meaning → Japanese without kanji', steps(W.cardPlan(bare, W.TRACK_RECALL)) === 'meaning | reading,notes', steps(W.cardPlan(bare, W.TRACK_RECALL)));
check('search by meaning, rōmaji and katakana',
  W.matchesQuery(full, 'stud') && W.matchesQuery(full, 'benkyou') && W.matchesQuery(bare, 'terebi') && W.matchesQuery(bare, 'てれび'));
check('search misses what is not there', !W.matchesQuery(full, 'xyz') && !W.matchesQuery(bare, 'gakkou'));
check('duplicate key is writing + reading', W.duplicateKey({ writing: ' 勉強', reading: 'べんきょう ' }) === W.duplicateKey(full));

// --- Sentences --------------------------------------------------------------

section('Sentences');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const wordList = (words) => words.map((x) => x.writing + '/' + x.reading).join(' ');

const listen = S.parse('もう一度（いちど）聞いて（きいて）ください。 — Please listen once more.');
check('Parse: sentence without brackets', listen.sentence === 'もう一度聞いてください。', listen.sentence);
check('Parse: reading when every kanji has one', listen.reading === 'もういちどきいてください。', listen.reading);
check('Parse: translation after " — "', listen.translation === 'Please listen once more.', listen.translation);
check('Parse: words, conjugated forms kept', wordList(listen.words) === '一度/いちど 聞いて/きいて', wordList(listen.words));

const ask = S.parse('質問（しつもん）を聞いて（きいて）もいいですか。 — May I ask a question?');
check('Parse: a particle before a word is stripped (を聞いて -> 聞いて)', wordList(ask.words) === '質問/しつもん 聞いて/きいて', wordList(ask.words));
check('Parse: お stays with its word', wordList(S.parse('お茶（おちゃ）を飲みます（のみます）。').words) === 'お茶/おちゃ 飲みます/のみます');
check('Parse: kana between kanji stays (落ち着いて)', wordList(S.parse('落ち着いて（おちついて）').words) === '落ち着いて/おちついて');
const study = S.parse('日本語を勉強（べんきょう）します');
check('Parse: the reading decides where the word starts (日本語を勉強 -> 勉強)', wordList(study.words) === '勉強/べんきょう', wordList(study.words));
check('Parse: no reading while a kanji has none', study.reading === '' && study.sentence === '日本語を勉強します', JSON.stringify(study));
check('Parse: ASCII and square brackets, tab before the translation',
  same(S.parse('聞く(きく)\tto listen; to ask'), { sentence: '聞く', reading: 'きく', translation: 'to listen; to ask', words: [{ writing: '聞く', reading: 'きく' }] }) &&
  S.parse('言う［いう］: to say').translation === 'to say' && S.parse('言う[いう] - to say').sentence === '言う');
const ru = S.parse('もう一度言って（いって）ください。Скажите ещё раз.');
check('Parse: Cyrillic translation without a delimiter', ru.translation === 'Скажите ещё раз.' && ru.sentence === 'もう一度言ってください。', JSON.stringify(ru));
check('Parse: Latin inside the Japanese is not a translation', S.parse('CDを買った（かった）。').translation === '' && S.parse('CDを買った（かった）。').sentence === 'CDを買った。');
check('Parse: a bracket after a kana-only word is dropped, no word', same(S.parse('ありがとう（ありがとう）').words, []) && S.parse('ありがとう（ありがとう）').sentence === 'ありがとう');
check('Parse: a bracket without kana is not a reading', S.parse('聞いて（polite）ください').sentence === '聞いて（polite）ください');
check('canParse: brackets or a translation, not a plain sentence',
  S.canParse('聞いて（きいて）') && S.canParse('ありがとう — thanks') && !S.canParse('もう一度聞いてください。'));

check('candidates: known readings where they occur',
  same(S.candidates('もう一度聞いてください。', listen.words), [{ writing: '一度', reading: 'いちど' }, { writing: '聞いて', reading: 'きいて' }]));
check('candidates: other kanji runs with an empty reading, in order',
  wordList(S.candidates('日本語を勉強します', study.words)) === '日本語/ 勉強/べんきょう', wordList(S.candidates('日本語を勉強します', study.words)));
check('candidates: plain text gives every kanji run, ご included',
  wordList(S.candidates('ご飯を食べる。')) === 'ご飯/ 食/', wordList(S.candidates('ご飯を食べる。')));
check('candidates: brackets left in the sentence still give readings', wordList(S.candidates('聞いて（きいて）ください')) === '聞いて/きいて');
check('candidates: each word once; kana-only sentence gives none',
  S.candidates('一度（いちど）、もう一度（いちど）').length === 1 && S.candidates('ありがとう').length === 0);

check('sentence is required, reading and translation are not',
  same(Object.keys(S.validate(S.normalizeDraft({ sentence: ' ' }))), ['sentence']) &&
  !Object.keys(S.validate(S.normalizeDraft({ sentence: '聞いて' }))).length);
check('reading: rōmaji becomes kana; kanji or stray letters are refused',
  S.normalizeDraft({ reading: 'mou ichido' }).reading === 'もう いちど' &&
  Boolean(S.validate(S.normalizeDraft({ sentence: 'x', reading: '一度' })).reading) &&
  Boolean(S.validate(S.normalizeDraft({ sentence: 'x', reading: 'qq' })).reading));
check('example = sentence, then translation on its own line',
  S.exampleFor({ sentence: '聞いて。', translation: 'Listen.' }) === '聞いて。\nListen.' &&S.exampleFor({ sentence: '聞いて。', translation: '' }) === '聞いて。');
const saved = { sentence: 'もう一度聞いてください。', reading: 'もういちどきいてください。', translation: 'Please listen once more.', notes: '' };
check('sentence search: text, translation, rōmaji reading', S.matchesQuery(saved, '聞いて') && S.matchesQuery(saved, 'listen') &&
  S.matchesQuery(saved, 'kiite') && !S.matchesQuery(saved, 'xyz'));
check('sentence review tracks are storage keys', S.TRACKS.join() === 'sentences.read,sentences.recall');
check('only a sentence with a translation is reviewed', S.isReviewable(saved) &&
  !S.isReviewable({ ...saved, translation: '  ' }) && !S.isReviewable({ sentence: '', translation: 'x' }));
const noted = { ...saved, notes: 'polite request' };
const kanaOnly = { sentence: 'はい、そうです。', reading: 'はい、そうです。', translation: 'Yes, it is.', notes: '' };
check('Japanese → translation: reading first when there are kanji, notes last',
  steps(S.cardPlan(noted, S.TRACK_READ)) === 'sentence | reading | translation,notes' &&
  steps(S.cardPlan({ ...saved, reading: '' }, S.TRACK_READ)) === 'sentence | translation' &&
  steps(S.cardPlan(kanaOnly, S.TRACK_READ)) === 'sentence | translation', steps(S.cardPlan(noted, S.TRACK_READ)));
check('Translation → Japanese: one step, the sentence with its reading and notes',
  steps(S.cardPlan(noted, S.TRACK_RECALL)) === 'translation | sentence,reading,notes' &&
  steps(S.cardPlan(kanaOnly, S.TRACK_RECALL)) === 'translation | sentence', steps(S.cardPlan(noted, S.TRACK_RECALL)));

// --- Kanji ------------------------------------------------------------------

section('Kanji');

check('library holds 2,099 kanji', Object.keys(KANJI_INDEX).length === 2099, 'got ' + Object.keys(KANJI_INDEX).length);
check('six levels whose counts add up', LIBRARY.levels.length === 6 &&
  LIBRARY.levels.reduce((s, l) => s + l.count, 0) === 2099);
check('学 is an N5 library kanji', K.isLibraryKanji('学') && K.indexEntry('学').level === 'N5');
check('N5 sorts before N1', K.compareKanji('学', K.allKanji().find((c) => K.indexEntry(c).level === 'N1')) < 0);
check('search by meaning prefix', K.matchesQuery('学', 'stud'));
check('search by kana reading', K.matchesQuery('学', 'がく'));
check('search by rōmaji reading', K.matchesQuery('学', 'gaku'));
check('search by pasted word', K.matchesQuery('勉', '勉強') && !K.matchesQuery('学', '勉強'));
check('Latin search is word-prefix ("on" does not match "prison")',
  !K.allKanji().filter((c) => K.matchesQuery(c, 'on')).some((c) => /prison/i.test(K.indexEntry(c).meaning)));
check('kanji card plans', steps(K.cardPlan(K.TRACK_READ)) === 'glyph | meaning | readings,strokes,words' &&
  steps(K.cardPlan(K.TRACK_RECALL)) === 'meaning | glyph | readings,strokes,words');
check('words using a kanji', K.wordsUsing('強', [full, bare]).length === 1);
check('sentences using a kanji: the sentence text only, not the translation or reading',
  K.sentencesUsing('聞', [{ sentence: 'もう一度聞いてください。' }, { sentence: 'はい。', translation: '聞', reading: '聞' }, {}])
    .map((s) => s.sentence).join() === 'もう一度聞いてください。');

// --- Storage normalize --------------------------------------------------------

section('Storage normalize');

const restored = normalize({
  app: 'hino_lite', version: 2,
  settings: { theme: 'neon', runSize: 12 },
  words: { a: { id: 'a', reading: 'あ', meaning: 'a', writing: 3 }, b: { reading: 'no id' } },
  kanji: { 学: { addedAt: 5, removed: 'yes' } },
  reviews: { 'words.read': { a: { score: 4, seen: 2 }, z: { score: -1 } } },
  kana: { mcq_k2r: { か: { score: -3 } } },
  sentences: { s1: { id: 's1', sentence: '聞いて。', translation: 7 }, s2: { sentence: 'no id' } }
});
check('unknown theme and run size fall back', restored.settings.theme === 'dark' && restored.settings.runSize === 15);
check('words without an id are dropped; bad fields become empty',
  Object.keys(restored.words).join() === 'a' && restored.words.a.writing === '');
check('removed is strictly boolean', restored.kanji['学'].removed === false);
check('never-answered review entries are absent (D56)', !restored.reviews['words.read'].z && restored.reviews['words.read'].a.score === 4);
check('kana scores floor at 0', restored.kana.mcq_k2r['か'].score === 0);
check('sentences without an id are dropped; bad fields become empty',
  Object.keys(restored.sentences).join() === 's1' && restored.sentences.s1.sentence === '聞いて。' && restored.sentences.s1.translation === '');
check('data saved before sentences existed loads with none', JSON.stringify(normalize({ app: 'hino_lite', version: 2 }).sentences) === '{}');
const newer = normalize(JSON.parse('{"app": "hino_lite", "version": 2, "tags": {"t1": "verbs"}, "settings": {"theme": "light", "fontSize": 3},' +
  ' "words": {"a": {"id": "a", "reading": "あ", "meaning": "a", "sentenceId": "s1"}},' +
  ' "sentences": {"s1": {"id": "s1", "sentence": "あ。", "audio": "x"}}, "__proto__": {"polluted": true}}'));
check('keys from a newer version are kept: top level, settings, words, sentences',
  newer.tags.t1 === 'verbs' && newer.settings.fontSize === 3 && newer.settings.theme === 'light' &&
  newer.words.a.sentenceId === 's1' && newer.sentences.s1.audio === 'x', JSON.stringify(newer));
check('a kept key never replaces a known one, and __proto__ is not copied',
  newer.words.a.reading === 'あ' && newer.version === 2 && Object.getPrototypeOf(newer) === Object.prototype && newer.polluted === undefined);

// --- Report -------------------------------------------------------------------

lines.push('', failures === 0 ? 'SELFTEST PASSED' : failures + ' check(s) failed\nSELFTEST FAILED');
const text = lines.join('\n');
document.getElementById('out').textContent = text;
fetch('/__report?name=selftest', { method: 'POST', body: text }).catch(() => {});
