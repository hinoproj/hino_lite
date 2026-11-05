// [MODULE] browser-smoke | End-to-end UI check: drives the real app in an iframe through kana, words, reviews, kanji, backup, sentences and back navigation
// [IFACE] layer: tooling | in: nothing -> out: report in #out and POSTed to /__report, ending SMOKE PASSED/FAILED | crosses: [browser DOM, localStorage, Cache Storage API, local HTTP server]
// [GRAPH] needs: [index] | feeds: [browser-smoke-page] | group: tooling
// [STATE] stateful | persists: clears hino_lite_v2 and the library cache before running | raises: nothing

const KEY = 'hino_lite_v2';
const lines = [];
const alerts = [];
const frame = document.getElementById('frame');
let w;
let d;

function log(name, ok, detail) {
  lines.push((ok ? 'ok   ' : 'FAIL ') + name + (detail !== undefined && !ok ? ' -- ' + detail : ''));
  document.getElementById('out').textContent = lines.join('\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 4000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (err) {
      // not there yet
    }
    await sleep(40);
  }
  return null;
}

const $ = (sel) => d.querySelector(sel);
const $$ = (sel) => Array.from(d.querySelectorAll(sel));
const visible = (id) => { const el = d.getElementById(id); return Boolean(el && !el.hidden); };
const saved = () => JSON.parse(w.localStorage.getItem(KEY));
const store = () => w.HinoLite.store;

function type(el, value) {
  el.value = value;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
}

async function tab(name) {
  $('#tabbar button[data-tab="' + name + '"]').click();
  return waitFor(() => visible('screen-' + name));
}

async function boot() {
  try { localStorage.removeItem(KEY); } catch (err) { /* storage blocked: the app reports it */ }
  for (const name of await caches.keys()) {
    if (name.startsWith('hino-lite-library-')) await caches.delete(name);
  }
  await new Promise((resolve) => { frame.onload = resolve; frame.src = '../index.html'; });
  w = frame.contentWindow;
  d = frame.contentDocument;
  await waitFor(() => w.HinoLite);
  w.confirm = () => true;
  w.alert = (m) => alerts.push(m);
}

// --- Kana ---------------------------------------------------------------------

async function kana() {
  log('tab bar shows five tabs', $$('#tabbar button').length === 5 && !d.getElementById('tabbar').hidden);
  log('kana is the start tab', visible('screen-kana'));
  const cards = $$('.deck-card');
  log('six deck cards rendered', cards.length === 6, cards.length);

  cards[0].click();
  await waitFor(() => visible('screen-kana-deck'));
  log('deck screen shown, tab bar hidden', visible('screen-kana-deck') && d.getElementById('tabbar').hidden);
  log('hiragana deck offers 3 modes', $$('.mode-row').length === 3);
  $$('#run-size button')[0].click();
  await sleep(50);

  $$('.mode-row')[0].querySelector('button.primary').click();
  await waitFor(() => visible('screen-kana-run'));
  log('timer visible, four options', !d.getElementById('timer').hidden && $$('#options button').length === 4);
  let answered = 0;
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    const prompt = $('#prompt').textContent;
    seen.add(prompt);
    const right = $$('#options button').find((b) => w.HinoLite.KANA_DATA.byKey[prompt].r === b.textContent);
    if (!right) break;
    right.click();
    answered += 1;
    await sleep(750);
  }
  log('answered 10 distinct kana', answered === 10 && seen.size === 10, answered + '/' + seen.size);
  log('summary says 10/10 and +50', $('#stat-correct').textContent === '10/10' && $('#stat-points').textContent === '+50',
    $('#stat-correct').textContent + ' ' + $('#stat-points').textContent);
  const scores = saved().kana.mcq_k2r;
  log('each kana saved with score 5', Object.keys(scores).length === 10 && Object.values(scores).every((e) => e.score === 5));

  d.getElementById('btn-again').click();
  await waitFor(() => visible('screen-kana-run'));
  const kanaShown = $('#prompt').textContent;
  const wrong = $$('#options button').find((b) => w.HinoLite.KANA_DATA.byKey[kanaShown].r !== b.textContent);
  wrong.click();
  await sleep(100);
  const after = saved().kana.mcq_k2r[kanaShown];
  const wrongKey = w.HinoLite.KANA_DATA.deckById.hira_basic.items.find((i) => i.r === wrong.textContent).key;
  log('a wrong answer floors at 0 and is remembered', after.score >= 0 && after.misses[0] === wrongKey, JSON.stringify(after));
  await sleep(1900);

  d.getElementById('btn-quit').click();
  await waitFor(() => visible('screen-kana-deck'));
  log('quit returns to the deck', visible('screen-kana-deck'));
  $$('.mode-row')[2].querySelector('button.primary').click();
  await waitFor(() => visible('screen-kana-run'));
  log('type mode hides options and timer', d.getElementById('options').hidden && d.getElementById('timer').hidden);
  const typed = $('#prompt').textContent;
  $('#type-input').value = w.HinoLite.KANA_DATA.byKey[typed].r;
  $('#type-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await sleep(100);
  log('typed answer scores +3', saved().kana.type_k2r[typed].score === 3);
  await sleep(800);
  d.getElementById('btn-quit').click();
  await waitFor(() => visible('screen-kana-deck'));
  d.getElementById('btn-kana-decks').click();
  await waitFor(() => visible('screen-kana'));
  $$('.deck-card')[3].click();
  await waitFor(() => visible('screen-kana-deck'));
  log('katakana deck offers 2 modes', $$('.mode-row').length === 2);
  d.getElementById('btn-kana-decks').click();
  await waitFor(() => visible('screen-kana'));
}

// --- Words --------------------------------------------------------------------

async function addWord(fields, pick) {
  $('#btn-add-word').click();
  await waitFor(() => visible('screen-word-form'));
  Object.entries(fields).forEach(([k, v]) => type($('#word-' + k), v));
  if (pick) $$('#reading-suggestions .suggestion')[pick === 'katakana' ? 1 : 0].click();
  $('#btn-save-word').click();
  return waitFor(() => visible('screen-words'));
}

async function words() {
  await tab('words');
  log('words tab starts with an empty state', Boolean($('#screen-words .empty')));

  $('#btn-add-word').click();
  await waitFor(() => visible('screen-word-form'));
  log('the form hides the tab bar', d.getElementById('tabbar').hidden);
  type($('#word-writing'), '勉強');
  log('kanji preview names the new kanji', $('#kanji-preview').textContent.includes('勉 強'), $('#kanji-preview').textContent);
  type($('#word-reading'), 'benkyou');
  const chips = $$('#reading-suggestions .suggestion');
  log('rōmaji offers hiragana and katakana', chips.length === 2 && chips[0].textContent === 'べんきょう' &&
    chips[1].textContent === 'ベンキョウ', chips.map((c) => c.textContent).join());
  chips[0].click();
  log('a suggestion replaces the reading', $('#word-reading').value === 'べんきょう');
  $('#btn-save-word').click();
  await sleep(80);
  log('meaning is required', visible('screen-word-form') && $('#word-meaning-error').textContent.length > 0);
  type($('#word-meaning'), 'study');
  type($('#word-example'), '毎日勉強します。');
  $('#btn-save-word').click();
  await waitFor(() => visible('screen-words'));
  log('the saved word is listed', $$('#word-list .word-row').length === 1);
  log('its kanji joined the kanji list', store().isEnrolled('勉') && store().isEnrolled('強'));

  await addWord({ reading: 'terebi', meaning: 'TV' }, 'katakana');
  await addWord({ writing: '学校', reading: 'gakkou', meaning: 'school' });
  const list = Object.values(saved().words);
  log('katakana suggestion and leftover rōmaji both end up as kana',
    list.some((x) => x.reading === 'テレビ') && list.some((x) => x.reading === 'がっこう'), list.map((x) => x.reading).join());
  log('three words listed', $$('#word-list .word-row').length === 3);
  const newGroups = $$('#word-list .word-group').map((g) => g.dataset.group).join();
  log('unreviewed words form one "New" group under a labelled search',
    newGroups === 'unseen' && $('#word-list .group-head').firstChild.textContent === 'New' &&
      $('#screen-words .filters label.filter-label[for="words-search"]') !== null, newGroups);

  $('#btn-add-word').click();
  await waitFor(() => visible('screen-word-form'));
  type($('#word-writing'), '勉強');
  type($('#word-reading'), 'べんきょう');
  type($('#word-meaning'), 'again');
  $('#btn-save-word').click();
  await sleep(80);
  log('a duplicate word is refused', visible('screen-word-form') && /already/.test($('#word-reading-error').textContent));
  $('#btn-cancel-word').click();
  await waitFor(() => visible('screen-words'));
  log('cancel returns to the list', visible('screen-words') && Object.keys(saved().words).length === 3);

  type($('#words-search'), 'terebi');
  log('search by rōmaji finds the katakana word', $$('#word-list .word-row').length === 1);
  type($('#words-search'), '');

  $$('#word-list .word-row').find((r) => r.querySelector('.word-head').textContent === '勉強').click();
  await waitFor(() => $('#word-view'));
  log('a word opens in the sheet', visible('sheet-layer') && Boolean($('#word-view')));
  log('word sheet: the hero holds a progress panel with both directions, unseen, and Mark as known; fields in their grid',
    $$('#word-view .word-hero .progress-panel .track').length === 2 && $$('#word-view .word-fields > .part').length === 3 &&
    $$('#word-view .word-fields > .part').every((p) => w.getComputedStyle(p).borderTopStyle === 'solid') &&
    $$('#word-view .track').every((t) => t.dataset.state === 'unseen' && !t.querySelector('.lit')) &&
    Boolean($('#btn-word-known')));
  $('#btn-edit-word').click();
  await waitFor(() => visible('screen-word-form'));
  log('edit prefills the form', $('#word-writing').value === '勉強' && $('#word-meaning').value === 'study');
  type($('#word-writing'), '勉強会');
  log('the preview shows only the new kanji', $('#kanji-preview').textContent.includes('会') &&
    !$('#kanji-preview').textContent.includes('勉'), $('#kanji-preview').textContent);
  $('#btn-save-word').click();
  await waitFor(() => visible('screen-words'));
  log('edit saved; old kanji stay, new one joins', store().isEnrolled('会') && store().isEnrolled('勉') &&
    Object.values(saved().words).some((x) => x.writing === '勉強会'));

  $('#btn-add-word').click();
  await waitFor(() => visible('screen-word-form'));
  w.history.back();
  await waitFor(() => visible('screen-words'));
  log('the back button leaves the form', visible('screen-words') && !d.getElementById('tabbar').hidden);
}

async function wordReviews() {
  $('.mode-row[data-track="words.read"] button.primary').click();
  await waitFor(() => visible('screen-review'));
  log('a word run starts with all 3 new words', $('#review-count').textContent === '1 / 3', $('#review-count').textContent);
  let stepsOk = true;
  for (let i = 0; i < 3; i++) {
    const prompt = $('.review-prompt').textContent;
    const word = Object.values(saved().words).find((x) => (x.writing || x.reading) === prompt);
    if (!word) { stepsOk = false; break; }
    let presses = 0;
    if (i === 0) { $('.review-card').click(); presses += 1; await sleep(20); }   // tapping the card = main button
    while ($('#btn-reveal') && presses < 5) { $('#btn-reveal').click(); presses += 1; await sleep(20); }
    if (presses !== (word.writing ? 2 : 1)) stepsOk = false;
    if (i === 0 && word.writing && !$('.review-step')) stepsOk = false;
    $('.rating.easy').click();
    await sleep(40);
  }
  log('Japanese → meaning reveals in the planned steps', stepsOk);
  await waitFor(() => visible('screen-review-summary'));
  log('summary counts three "Easy!"', $('.stat.easy .value').textContent === '3');
  const reviews = saved().reviews['words.read'];
  log('a first "Easy!" makes a word learned (5)', Object.values(reviews).length === 3 && Object.values(reviews).every((e) => e.score === 5));
  $('#btn-review-done').click();
  await waitFor(() => visible('screen-words'));
  log('done returns to the words tab', visible('screen-words'));

  $('.mode-row[data-track="words.recall"] button.primary').click();
  await waitFor(() => visible('screen-review'));
  const meanings = Object.values(saved().words).map((x) => x.meaning);
  log('Meaning → Japanese prompts with the meaning', meanings.includes($('.review-prompt').textContent), $('.review-prompt').textContent);
  for (let i = 0; i < 3; i++) {
    if ($('#btn-reveal-all')) $('#btn-reveal-all').click(); else $('#btn-reveal').click();
    await sleep(20);
    if (i === 0) {
      $('#btn-rating-help').click();
      await waitFor(() => $('#rating-help'));
      log('rating help opens without any points in it', Boolean($('#rating-help')) && !/[+−-]\d/.test($('#rating-help').textContent));
      $('#rating-help .sheet-head button').click();
      await waitFor(() => !visible('sheet-layer'));
      log('closing the help keeps the run', !visible('sheet-layer') && visible('screen-review'));
    }
    $('.rating.missed').click();
    await sleep(40);
  }
  await waitFor(() => visible('screen-review-summary'));
  const recall = saved().reviews['words.recall'];
  log('a first "Didn\'t know" scores 0 in its own track', Object.values(recall).length === 3 &&
    Object.values(recall).every((e) => e.score === 0) && Object.values(saved().reviews['words.read']).every((e) => e.score === 5));
  $('#btn-review-done').click();
  await waitFor(() => visible('screen-words'));

  const tv = Object.values(saved().words).find((x) => x.reading === 'テレビ');
  $('#word-list .word-row[data-id="' + tv.id + '"]').click();
  await waitFor(() => $('#word-view'));
  const lit = (i) => $$('#word-view .track')[i].querySelectorAll('.lit').length;
  log('word sheet: steps light up to the state (learned 3, unknown 1)', lit(0) === 3 && lit(1) === 1, lit(0) + ',' + lit(1));
  $('#btn-word-known').click();
  await waitFor(() => !$('#btn-word-known'));
  log('mark as known: Meaning → Japanese rises to learned, Japanese → meaning stays',
    store().reviewStats('words.read', tv.id).score === 5 && store().reviewStats('words.recall', tv.id).score === 5 &&
    $$('#word-view .track').every((t) => t.dataset.state === 'learned') && visible('sheet-layer'));
  $('#word-view .sheet-head button').click();
  await waitFor(() => !visible('sheet-layer'));
  await waitFor(() => $('#word-list .word-group[data-group="learned"]'));
  const groups = $$('#word-list .word-group').map((g) => g.dataset.group).join();
  log('the list regroups by progress, least known first, in two columns when wide',
    groups === 'learning,learned' && Boolean($('.word-group[data-group="learned"] .word-row[data-id="' + tv.id + '"]')) &&
      w.getComputedStyle($('#word-list .word-grid')).gridTemplateColumns.split(' ').length === 2, groups);
}

// --- Kanji --------------------------------------------------------------------

async function openTile(ch) {
  $('.kanji-tile[data-kanji="' + ch + '"]').click();
  return waitFor(() => $('#kanji-card[data-kanji="' + ch + '"]'));
}

async function closeCard() {
  $('#btn-card-close').click();
  return waitFor(() => !visible('sheet-layer'));
}

async function kanji() {
  await tab('kanji');
  const ready = await waitFor(async () => (await w.HinoLite.library.readyLevels()).size === 6, 60000);
  log('the library downloads on first open (6 levels)', Boolean(ready));
  await waitFor(() => !$('#library-status .library-panel') && $$('.kanji-tile').length);
  log('Mine shows the 5 kanji from the words', $$('.kanji-tile').length === 5, $$('.kanji-tile').map((t) => t.dataset.kanji).join(''));

  $$('#screen-kanji .filters .segmented button')[1].click();
  await waitFor(() => $$('.kanji-tile').length > 5);
  log('All shows 2,099 kanji in level sections', $$('.kanji-tile').length === 2099 && $$('.kanji-section').length === 6,
    $$('.kanji-tile').length);
  $('.level-chip[data-level="N1"]').click();
  await sleep(50);
  log('a level chip hides that level', $$('.kanji-tile').length === 2099 - 1002, $$('.kanji-tile').length);
  $('.level-chip[data-level="N1"]').click();
  await sleep(50);
  type($('#kanji-search'), 'gaku');
  log('search by rōmaji reading finds 学', Boolean($('.kanji-tile[data-kanji="学"]')));
  type($('#kanji-search'), '');
  const filterGroups = $$('#screen-kanji .filters .filter');
  const filterBottoms = filterGroups.map((g) => Math.round(g.getBoundingClientRect().bottom));
  log('library toolbar: Show, JLPT level and Search, labelled, in one row at tablet width',
    filterGroups.map((g) => g.querySelector('.filter-label').textContent).join('|') === 'Show|JLPT level|Search' &&
      new Set(filterBottoms).size === 1 && $('label.filter-label[for="kanji-search"]') !== null,
    filterBottoms.join(','));

  await openTile('学');
  log('card: stroke order, readings, example words',
    Boolean($('#kanji-card .strokes svg')) && $$('#kanji-card .reading-pill').length >= 2 &&
    $$('#kanji-card .example-row').length > 0 && $$('#kanji-card .example-row').length <= 8 &&
    $$('#kanji-card .examples-zone .example-row').length > 0);
  log('card: "In your words" lists 学校', $$('#kanji-card [data-word-id]').some((b) => b.textContent === '学校'));
  log('card: the progress panel shows both directions, radicals sit in the readings panel',
    $$('#kanji-card .progress-panel .track').length === 2 && Boolean($('#kanji-card .readings-zone .parts')));
  const link = $('#kanji-card .rc-link');
  if (link) {
    const target = link.dataset.kanji;
    link.click();
    await waitFor(() => $('#kanji-card[data-kanji="' + target + '"]'));
    $('#btn-card-back').click();
    await waitFor(() => $('#kanji-card[data-kanji="学"]'));
    log('a component opens its card and ← comes back', Boolean($('#kanji-card[data-kanji="学"]')));
  }
  const mine = Object.values(saved().words).map((x) => x.writing);
  const rows = $$('#kanji-card .example-row');
  rows.find((r) => mine.includes(r.querySelector('.w').textContent)).click();
  await waitFor(() => $('#example-word'));
  log('an example word already saved shows "In your words"', Boolean($('#btn-open-my-word')) && !$('#btn-add-example'));
  $('#btn-card-back').click();
  await waitFor(() => $('#kanji-card[data-kanji="学"]'));
  $$('#kanji-card .example-row').find((r) => !mine.includes(r.querySelector('.w').textContent)).click();
  await waitFor(() => $('#example-word'));
  const example = $('#example-word .hero-word').textContent;
  log('an example word opens with its meanings', Boolean($('#example-word .senses li')));
  $('#btn-add-example').click();
  await waitFor(() => visible('screen-word-form'));
  log('"+ Add to my words" opens a prefilled form', $('#word-writing').value === example && $('#word-reading').value.length > 0,
    $('#word-writing').value);
  $('#btn-cancel-word').click();
  await waitFor(() => visible('screen-words'));

  await tab('kanji');
  $$('#screen-kanji .filters .segmented button')[0].click();
  await waitFor(() => $$('.kanji-tile').length === 5);
  await openTile('会');
  $('#btn-kanji-remove').click();
  await waitFor(() => $('#btn-kanji-add'));
  log('remove takes 会 off the list', !store().isEnrolled('会') && Boolean($('#btn-kanji-add')));
  await closeCard();
  log('Mine now shows 4 kanji', $$('.kanji-tile').length === 4, $$('.kanji-tile').length);

  $$('#screen-kanji .filters .segmented button')[1].click();
  await waitFor(() => $$('.kanji-tile').length > 5);
  await openTile('一');
  $('#btn-kanji-add').click();
  await waitFor(() => $('#btn-kanji-remove'));
  $('#btn-kanji-known').click();
  await waitFor(() => !$('#btn-kanji-known'));
  log('add + mark as known: 一 is learned in both directions', store().isEnrolled('一') &&
    store().reviewStats('kanji.read', '一').score === 5 && store().reviewStats('kanji.recall', '一').score === 5);
  await closeCard();

  $('.mode-row[data-track="kanji.read"] button.primary').click();
  await waitFor(() => visible('screen-review'), 6000);
  log('a kanji run: 4 new + 1 known', $('#review-count').textContent === '1 / 5', $('#review-count').textContent);
  let ok = true;
  for (let i = 0; i < 5; i++) {
    if (!$('.review-prompt .prompt-glyph')) ok = false;
    $('#btn-reveal').click();
    await sleep(20);
    $('#btn-reveal').click();
    await sleep(20);
    if (!$('#screen-review .reading-pill')) ok = false;
    $('.rating.knew').click();
    await sleep(40);
  }
  log('Kanji → meaning: glyph, then meaning, then readings', ok);
  await waitFor(() => visible('screen-review-summary'));
  log('a first "Knew it" scores 4', store().reviewStats('kanji.read', '学').score === 4);
  $('#btn-review-done').click();
  await waitFor(() => visible('screen-kanji'));
}

// --- Backup, reminder, theme -------------------------------------------------------

async function backup() {
  const st = store();
  const exported = st.exportText();
  st.reset();
  log('reset empties words and the kanji list', st.listWords().length === 0 && st.listKanji().length === 0);
  log('import restores them', st.importText(exported).ok && st.listWords().length === 3 && st.listKanji().length === 5);
  log('old Kana SRS backups are refused', !st.importText(JSON.stringify({ progress: { mcq_k2r: {} } })).ok);
  log('a removed kanji keeps its scores through a backup', !st.isEnrolled('会') && st.kanjiEntry('会').removed === true);

  st.raw().unsavedSince = Date.now() - 8 * 86400000;
  st.save();
  await tab('words');
  log('a week of unsaved changes shows the reminder', visible('backup-banner'));
  $('#backup-banner button').click();
  await sleep(100);
  log('backing up clears it', !visible('backup-banner') && !st.backupStatus().due);

  await tab('settings');
  const themes = $$('#theme-picker button');
  log('three themes offered', themes.length === 3);
  themes[2].click();
  await sleep(50);
  log('kids theme applied and saved', d.documentElement.getAttribute('data-theme') === 'kids' &&
    d.getElementById('theme-color').getAttribute('content') === '#fff6e5' && saved().settings.theme === 'kids');
  await tab('words');
  $('.mode-row[data-track="words.read"] button.primary').click();
  await waitFor(() => visible('screen-review'));
  if ($('#btn-reveal-all')) $('#btn-reveal-all').click(); else $('#btn-reveal').click();
  await sleep(20);
  $('.rating.knew').click();
  await sleep(30);
  log('kids theme cheers a good rating', /[✨🌟🎉🙌]/u.test($('#review-verdict').textContent), $('#review-verdict').textContent);
  await sleep(800);
  $('#btn-review-quit').click();
  await waitFor(() => visible('screen-words'));
  log('quitting a run returns to the tab', visible('screen-words'));
  await tab('settings');
  $$('#theme-picker button')[0].click();
  await sleep(50);
  log('switching back restores dark', d.documentElement.getAttribute('data-theme') === 'dark');
}

// --- Sentences -----------------------------------------------------------------

const promptRows = () => $$('#prompt-rows .prompt-row');
const rowValue = (row, cls) => row.querySelector('.' + cls).value;

async function sentences() {
  const st = store();
  const wordsBefore = st.listWords().length;
  await tab('sentences');
  log('sentences tab starts with an empty state', Boolean($('#screen-sentences .empty')));

  $('#btn-add-sentence').click();
  await waitFor(() => visible('screen-sentence-form'));
  log('the sentence form hides the tab bar; no Parse yet', d.getElementById('tabbar').hidden && $('#btn-parse').hidden);
  type($('#sentence-sentence'), 'もう一度（いちど）聞いて（きいて）ください。 — Please listen once more.');
  log('brackets show Parse', !$('#btn-parse').hidden);
  $('#btn-parse').click();
  log('Parse fills sentence, reading and translation', $('#sentence-sentence').value === 'もう一度聞いてください。' &&
    $('#sentence-reading').value === 'もういちどきいてください。' && $('#sentence-translation').value === 'Please listen once more.',
    [$('#sentence-sentence').value, $('#sentence-reading').value, $('#sentence-translation').value].join(' | '));
  $('#btn-parse-undo').click();
  log('Undo puts the pasted text back', $('#sentence-sentence').value.includes('（いちど）') && $('#sentence-translation').value === '');
  $('#btn-parse').click();
  $('#btn-save-sentence').click();
  await waitFor(() => visible('screen-sentence-words'));
  let rows = promptRows();
  log('saving offers its kanji words with their readings', rows.length === 2 && rowValue(rows[0], 'pw-writing') === '一度' &&
    rowValue(rows[0], 'pw-reading') === 'いちど' && rowValue(rows[1], 'pw-writing') === '聞いて',
    rows.map((r) => rowValue(r, 'pw-writing') + '/' + rowValue(r, 'pw-reading')).join());
  log('Add waits for a meaning', rows.every((r) => r.querySelector('.pw-add').disabled));
  type(rows[1].querySelector('.pw-meaning'), 'listen (て-form of 聞く)');
  log('a meaning enables Add', !rows[1].querySelector('.pw-add').disabled);
  rows[1].querySelector('.pw-add').click();
  await sleep(50);
  const card = st.listWords().find((x) => x.writing === '聞いて');
  log('Add saves the word with the sentence as its example', Boolean(card) && card.reading === 'きいて' &&
    card.example === 'もう一度聞いてください。\nPlease listen once more.' && rows[1].dataset.status === 'added', JSON.stringify(card));
  log('its kanji join the kanji list', st.isEnrolled('聞'));
  $('#btn-prompt-done').click();
  await waitFor(() => visible('screen-sentences'));
  log('Done returns to the list', $$('#sentence-list .sentence-row').length === 1);

  $('#btn-add-sentence').click();
  await waitFor(() => visible('screen-sentence-form'));
  type($('#sentence-sentence'), '質問（しつもん）を聞いて（きいて）もいいですか。 — May I ask a question?');
  $('#btn-parse').click();
  $('#btn-save-sentence').click();
  await waitFor(() => visible('screen-sentence-words'));
  rows = promptRows();
  log('a word already in the list is only marked', rows.length === 2 && rows[1].dataset.status === 'dup' &&
    /already in your list/i.test(rows[1].textContent) && rows[1].querySelector('.pw-add').hidden);
  w.history.back();
  await waitFor(() => visible('screen-sentences'));
  log('the back button leaves the prompt; nothing else added', visible('screen-sentences') && st.listWords().length === wordsBefore + 1);

  $('#btn-add-sentence').click();
  await waitFor(() => visible('screen-sentence-form'));
  type($('#sentence-sentence'), '毎日、本を読む。');
  log('a plain sentence shows no Parse', $('#btn-parse').hidden);
  $('#btn-save-sentence').click();
  await waitFor(() => visible('screen-sentence-words'));
  rows = promptRows();
  log('without brackets, each kanji run comes with an empty reading', rows.length === 3 &&
    rowValue(rows[0], 'pw-writing') === '毎日' && rowValue(rows[0], 'pw-reading') === '' && rowValue(rows[1], 'pw-writing') === '本');
  type(rows[0].querySelector('.pw-meaning'), 'every day');
  log('Add also needs a reading', rows[0].querySelector('.pw-add').disabled);
  type(rows[0].querySelector('.pw-reading'), 'mainichi');
  rows[0].querySelector('.pw-add').click();
  await sleep(50);
  log('a rōmaji reading is saved as kana', st.listWords().some((x) => x.writing === '毎日' && x.reading === 'まいにち'));
  $('#btn-prompt-done').click();
  await waitFor(() => visible('screen-sentences'));

  // Sentence reviews (P19): only sentences with a translation take part.
  const open = async (text) => {
    $$('#sentence-list .sentence-row').find((r) => r.textContent.includes(text)).click();
    return waitFor(() => $('#sentence-view'));
  };
  const readLabel = () => ($('.mode-row[data-track="sentences.read"] .meter-label') || {}).textContent || '';
  log('the review panel counts only sentences with a translation; the other row says so',
    $$('#screen-sentences .mode-row').length === 2 && readLabel().includes('2 new') &&
      /not in reviews/.test(($('#sentence-list .no-translation') || {}).textContent || ''), readLabel());
  $('.mode-row[data-track="sentences.read"] button.primary').click();
  await waitFor(() => visible('screen-review'));
  log('a sentence run holds the 2 translated sentences', $('#review-count').textContent === '1 / 2', $('#review-count').textContent);
  let planOk = true;
  for (let i = 0; i < 2; i++) {
    const s = st.listSentences().find((x) => x.sentence === $('.review-prompt').textContent);
    if (!s) { planOk = false; break; }
    $('#btn-reveal').click();
    await sleep(20);
    if (!$('.review-step') || !$('.review-step').textContent.includes(s.reading)) planOk = false;
    $('#btn-reveal').click();
    await sleep(20);
    if ($('#btn-reveal') || !$('.review-card').textContent.includes(s.translation)) planOk = false;
    $('.rating.easy').click();
    await sleep(40);
  }
  log('Japanese → translation: the sentence, its reading, then the translation', planOk);
  await waitFor(() => visible('screen-review-summary'));
  const sentenceRead = saved().reviews['sentences.read'] || {};
  log('the run scores its own track', Object.keys(sentenceRead).length === 2 &&
    Object.values(sentenceRead).every((e) => e.score === 5), JSON.stringify(sentenceRead));
  $('#btn-review-done').click();
  await waitFor(() => visible('screen-sentences'));

  $('.mode-row[data-track="sentences.recall"] button.primary').click();
  await waitFor(() => visible('screen-review'));
  log('Translation → Japanese prompts with the translation, one step shows the sentence',
    st.listSentences().some((x) => x.translation === $('.review-prompt').textContent) &&
      $('#btn-reveal').textContent === 'Show sentence' && !$('#btn-reveal-all'), $('.review-prompt').textContent);
  for (let i = 0; i < 2; i++) {
    $('#btn-reveal').click();
    await sleep(20);
    $('.rating.missed').click();
    await sleep(40);
  }
  await waitFor(() => visible('screen-review-summary'));
  $('#btn-review-done').click();
  await waitFor(() => visible('screen-sentences'));
  const sentenceGroups = () => $$('#sentence-list .sentence-group').map((g) => g.dataset.group).join();
  log('the list groups sentences by progress, least known first', sentenceGroups() === 'unseen,learning', sentenceGroups());

  await open('もう一度');
  log('the sentence sheet shows both directions and Mark as known',
    $$('#sentence-view .track').length === 2 && Boolean($('#btn-sentence-known')));
  $('#btn-sentence-known').click();
  await waitFor(() => !$('#btn-sentence-known'));
  const listen = st.listSentences().find((x) => x.sentence.startsWith('もう一度'));
  log('mark as known: both directions learned, the sentence moves to Learned',
    st.reviewStats('sentences.read', listen.id).score === 5 && st.reviewStats('sentences.recall', listen.id).score === 5 &&
      sentenceGroups() === 'unseen,learning,learned', sentenceGroups());
  $('#sentence-view .sheet-head button').click();
  await waitFor(() => !visible('sheet-layer'));
  await open('毎日');
  log('an untranslated sentence\'s sheet says why it is not reviewed',
    Boolean($('#sentence-no-review')) && !$('#sentence-view .track') && !$('#btn-sentence-known'));
  $('#sentence-view .sheet-head button').click();
  await waitFor(() => !visible('sheet-layer'));

  type($('#sentences-search'), 'question');
  log('search finds a sentence by its translation', $$('#sentence-list .sentence-row').length === 1);
  type($('#sentences-search'), '');

  await open('毎日');
  $('#btn-edit-sentence').click();
  await waitFor(() => visible('screen-sentence-form'));
  log('edit prefills the form', $('#sentence-sentence').value === '毎日、本を読む。');
  type($('#sentence-translation'), 'I learn every day.');
  $('#btn-save-sentence').click();
  await waitFor(() => visible('screen-sentences'));
  log('editing saves without a prompt', visible('screen-sentences') && st.listSentences().some((x) => x.translation === 'I learn every day.'));

  await tab('kanji');
  await waitFor(() => $('.kanji-tile[data-kanji="聞"]'));
  await openTile('聞');
  const cardSentences = $$('#kanji-card .card-sentence');
  log('a kanji card lists the sentences that use it, the kanji marked', cardSentences.length === 2 &&
    cardSentences.every((r) => r.querySelector('mark').textContent === '聞'), cardSentences.map((r) => r.textContent).join(' | '));
  cardSentences[0].click();
  await waitFor(() => $('#sentence-view'));
  log('tapping one opens the sentence', Boolean($('#sentence-view')) && $('#sentence-view').textContent.includes('聞'));
  $('#sentence-view .sheet-head button').click();
  await waitFor(() => !visible('sheet-layer'));

  const exported = st.exportText();
  st.reset();
  log('a backup restores the sentences', st.importText(exported).ok && st.listSentences().length === 3);

  await tab('sentences');
  await open('毎日');
  $('#btn-delete-sentence').click();
  await waitFor(() => !visible('sheet-layer'));
  log('deleting a sentence keeps its word cards', st.listSentences().length === 2 && st.listWords().some((x) => x.writing === '毎日'));
  const listenId = st.listSentences().find((x) => x.sentence.startsWith('もう一度')).id;
  await open('もう一度');
  $('#btn-delete-sentence').click();
  await waitFor(() => !visible('sheet-layer'));
  log('deleting a reviewed sentence drops its progress', !st.getSentence(listenId) &&
    !(saved().reviews['sentences.read'] || {})[listenId] && !(saved().reviews['sentences.recall'] || {})[listenId]);
}

// --- Another tab, a newer version ------------------------------------------------

async function otherTab() {
  // This page shares the app's localStorage, so writing here is "another tab saving".
  const data = saved();
  data.words.other = { id: 'other', writing: '', reading: 'ほか', meaning: 'other', example: '', notes: '', createdAt: 1, updatedAt: 1 };
  data.fromNewerVersion = { kept: true };
  localStorage.setItem(KEY, JSON.stringify(data));
  log('a save from another tab is taken over', Boolean(await waitFor(() => store().getWord('other'))));
  store().setRunSize(10);
  log('our next save keeps it, and keeps data from a newer version', Boolean(saved().words.other) &&
    saved().fromNewerVersion && saved().fromNewerVersion.kept === true && saved().settings.runSize === 10);
}

async function serviceWorker() {
  const reg = await waitFor(() => w.navigator.serviceWorker.getRegistration().then((r) => r && r.active), 15000);
  log('the service worker installs (every precached file exists)', Boolean(reg));
}

async function run() {
  await boot();
  await kana();
  await words();
  await wordReviews();
  await kanji();
  await backup();
  await sentences();
  await otherTab();
  await serviceWorker();
  log('no alerts were raised', alerts.length === 0, alerts.join(' | '));
}

run().catch((err) => {
  log('exception', false, err && err.stack ? err.stack : String(err));
}).finally(() => {
  lines.push(lines.some((l) => l.startsWith('FAIL')) ? 'SMOKE FAILED' : 'SMOKE PASSED');
  const text = lines.join('\n');
  document.getElementById('out').textContent = text;
  fetch('/__report?name=smoke', { method: 'POST', body: text }).catch(() => {});
});
