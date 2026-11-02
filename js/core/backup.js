// [MODULE] backup | Backup file I/O: download the learner's data as JSON, read a chosen backup file back
// [IFACE] layer: presentation | in: user actions, a File -> out: a downloaded .json, import result | crosses: [browser downloads, FileReader]
// [GRAPH] needs: [storage] | feeds: [shell, settings-ui] | group: presentation
// [STATE] stateless | persists: via storage (marks the backup time) | raises: nothing

import * as store from './storage.js';

/** Save everything to a file and clear the backup reminder. */
export function exportBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([store.exportText()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hino-lite-backup-' + stamp + '.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  store.markBackedUp();
}

/** Replace everything with a backup file. Resolves to {ok} or {ok: false, error}. */
export function importBackupFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(store.importText(String(reader.result)));
    reader.onerror = () => {
      console.error('[backup.js][importBackupFile] file read failed: ' + reader.error);
      resolve({ ok: false, error: 'Could not read that file.' });
    };
    reader.readAsText(file);
  });
}
