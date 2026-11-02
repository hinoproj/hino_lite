// [MODULE] shell | Screen switching, bottom tabs, the sheet overlay, the back stack (Android back button), backup reminder
// [IFACE] layer: presentation | in: tab renderers, screen ids, back handlers -> out: visible screen, tab bar state, history entries | crosses: [browser DOM, History API]
// [GRAPH] needs: [dom, storage, backup] | feeds: [main, kana-ui, words-ui, sentences-ui, review-ui, kanji-ui, kanji-card, settings-ui] | group: presentation
// [STATE] stateful | persists: nothing (in-memory back stack) | raises: nothing

import { $, h, button, formatDaysAgo } from './dom.js';
import * as store from './storage.js';
import { exportBackup } from './backup.js';

/**
 * Tab screens carry data-tab and show the tab bar; focus screens (a run, the
 * word form) hide it. The back stack makes Android's back button behave: every
 * focus screen or open sheet pushes one history entry with a handler, the
 * button (or leave()) pops it and the handler navigates. Moving from one
 * back-able state straight to another (sheet -> form, run -> summary) swaps
 * the handler instead, so the history never holds an entry nothing answers.
 */

export const TABS = ['kana', 'words', 'sentences', 'kanji', 'settings'];
const renderers = {};
const backStack = [];
let currentTab = 'kana';

export function registerTab(tab, render) {
  renderers[tab] = render;
}

export function activeTab() {
  return currentTab;
}

/** Render a tab (also re-renders the current one, e.g. after an import). */
export function goTab(tab) {
  if (!renderers[tab]) return;
  closeSheetNow();
  try {
    history.replaceState(history.state, '', '#' + tab);
  } catch (err) {
    console.warn('[shell.js][goTab] could not update the address: ' + err.message);
  }
  renderers[tab]();
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
  const tab = $(id).dataset.tab;
  const bar = $('tabbar');
  bar.hidden = !tab;
  if (tab) {
    currentTab = tab;
    bar.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
    });
  }
  renderBackupBanner(Boolean(tab) && tab !== 'settings');
  window.scrollTo(0, 0);
}

// --- Back stack -----------------------------------------------------------

export function enterBack(handler) {
  backStack.push(handler);
  history.pushState({ hinoBack: backStack.length }, '');
}

/** Replace the top handler (or push one if there is none) without a new history entry. */
export function swapBack(handler) {
  if (backStack.length) backStack[backStack.length - 1] = handler;
  else enterBack(handler);
}

/** Go back one step, exactly as the Android back button would. */
export function leave() {
  if (backStack.length) history.back();
}

window.addEventListener('popstate', () => {
  const handler = backStack.pop();
  if (handler) handler();
});

// --- Sheet ------------------------------------------------------------------

/** Show content in the overlay sheet; replaces what is there if it is already open. */
export function openSheet(content, { label } = {}) {
  const layer = $('sheet-layer');
  const sheet = $('sheet');
  sheet.replaceChildren(content);
  sheet.setAttribute('aria-label', label || '');
  sheet.scrollTop = 0;
  if (layer.hidden) {
    layer.hidden = false;
    document.body.classList.add('sheet-open');
    enterBack(closeSheetNow);
  }
}

export function sheetOpen() {
  return !$('sheet-layer').hidden;
}

/** Close as the back button would (pops the sheet's history entry). */
export function closeSheet() {
  if (sheetOpen()) leave();
}

/** Close without touching history -- for callers that swap the entry to another state. */
export function closeSheetNow() {
  const layer = $('sheet-layer');
  if (layer.hidden) return;
  layer.hidden = true;
  $('sheet').replaceChildren();
  document.body.classList.remove('sheet-open');
}

export function bindShell() {
  $('tabbar').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => goTab(b.dataset.tab));
  });
  $('sheet-layer').addEventListener('click', (e) => {
    if (e.target === $('sheet-layer')) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen()) closeSheet();
  });
}

// --- Backup reminder ----------------------------------------------------------

function renderBackupBanner(visible) {
  const banner = $('backup-banner');
  const status = store.backupStatus();
  banner.hidden = !(visible && status.due);
  if (banner.hidden) return;
  banner.replaceChildren(
    h('span', null, 'Your words are not backed up. Last backup: ' + formatDaysAgo(status.lastBackupAt) + '.'),
    button('Back up now', () => {
      exportBackup();
      renderBackupBanner(false);
    }, 'primary small')
  );
}
