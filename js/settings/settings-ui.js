// [MODULE] settings-ui | Settings tab: theme picker, backup export/import with status, storage status, reset
// [IFACE] layer: presentation | in: DOM events on the settings screen, a chosen backup file -> out: rendered settings, theme/backup/reset actions | crosses: [browser DOM]
// [GRAPH] needs: [storage, theme, backup, shell, dom] | feeds: [main] | group: presentation
// [STATE] stateless | persists: via storage | raises: nothing

import * as store from '../core/storage.js';
import { applyTheme } from '../core/theme.js';
import { exportBackup, importBackupFile } from '../core/backup.js';
import * as shell from '../core/shell.js';
import { $, segmented, confirmAction, notify, formatDaysAgo } from '../core/dom.js';

const THEME_LABELS = { dark: 'Dark', light: 'Light', kids: 'Kids' };

function renderThemePicker() {
  const options = store.THEMES.map((t) => ({ value: t, label: THEME_LABELS[t] }));
  $('theme-picker').replaceChildren(segmented(options, store.getSettings().theme, (theme) => {
    store.setTheme(theme);
    applyTheme();
    renderThemePicker();
  }, 'Theme'));
}

function renderBackupStatus() {
  const status = store.backupStatus();
  $('backup-status').textContent = 'Last backup: ' + formatDaysAgo(status.lastBackupAt) +
    (status.unsavedSince ? ' · there are changes since then.' : ' · nothing new since then.');
}

async function renderStorageStatus() {
  if (!store.isAvailable()) {
    $('storage-status').textContent = 'This browser is blocking storage for the app, so nothing lasts beyond this session. Export a backup before closing it.';
    return;
  }
  const persisted = await store.isPersisted();
  $('storage-status').textContent = persisted
    ? 'Everything is saved on this device, and the browser has agreed to keep it.'
    : 'Everything is saved on this device. Installing the app to the home screen keeps it safest.';
}

export function renderSettings() {
  renderThemePicker();
  renderBackupStatus();
  renderStorageStatus();
  shell.showScreen('screen-settings');
}

export function initSettings() {
  $('btn-export').addEventListener('click', () => {
    exportBackup();
    renderBackupStatus();
  });
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!confirmAction('Replace everything in the app with this backup?')) return;
    const result = await importBackupFile(file);
    if (!result.ok) {
      notify(result.error);
      return;
    }
    applyTheme();
    notify('Backup loaded.');
    renderSettings();
  });
  $('btn-reset').addEventListener('click', () => {
    if (!confirmAction('Erase all words, your kanji list and every score? This cannot be undone.')) return;
    if (!confirmAction('Really erase everything? Export a backup first if you might want it back.')) return;
    store.reset();
    renderSettings();
  });
}
