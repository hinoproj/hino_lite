// [MODULE] main | Boot: load data, apply theme, wire the shell and the four tabs, route the address, register the service worker
// [IFACE] layer: presentation | in: page load, location.hash -> out: the first rendered tab, a registered service worker | crosses: [browser DOM, service worker]
// [GRAPH] needs: [storage, theme, shell, kana-ui, words-ui, kanji-ui, settings-ui, kana-data, library, sw] | feeds: [index] | group: presentation
// [STATE] stateful | persists: via storage | raises: nothing

import * as store from './core/storage.js';
import { applyTheme } from './core/theme.js';
import * as shell from './core/shell.js';
import { initKana, renderKanaHome } from './kana/kana-ui.js';
import { renderWords } from './words/words-ui.js';
import { renderKanji } from './kanji/kanji-ui.js';
import { initSettings, renderSettings } from './settings/settings-ui.js';
import { KANA_DATA } from './kana/kana-data.js';
import * as library from './kanji/library.js';

/**
 * Addresses: #kana (default), #words, #kanji, #kanji/<kanji> (opens its card),
 * #settings. Tabs replace the address rather than adding history entries; the
 * back stack in shell.js owns history.
 */
function route() {
  const [tab, arg] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (tab === 'kanji' && arg) {
    renderKanji(arg);
  } else {
    shell.goTab(shell.TABS.includes(tab) ? tab : 'kana');
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch((err) => {
    console.warn('[main.js][registerServiceWorker] offline cache unavailable: ' + err.message);
  });
}

function init() {
  store.load();
  applyTheme();
  shell.bindShell();
  initKana();
  initSettings();
  shell.registerTab('kana', renderKanaHome);
  shell.registerTab('words', renderWords);
  shell.registerTab('kanji', () => renderKanji());
  shell.registerTab('settings', renderSettings);
  route();
  store.requestPersistence();
  registerServiceWorker();
  // Debug and test handle: tools/browser-smoke.js reads state through it.
  window.HinoLite = { store, KANA_DATA, library };
}

init();
