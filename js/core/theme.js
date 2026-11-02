// [MODULE] theme | Applies the chosen palette and owns the Kids theme's cheering strings
// [IFACE] layer: presentation | in: theme id from storage -> out: data-theme on <html>, theme-color meta, cheer strings | crosses: [browser DOM]
// [GRAPH] needs: [storage] | feeds: [main, kana-ui, review-ui, settings-ui] | group: presentation
// [STATE] stateless | persists: nothing | raises: nothing

import * as store from './storage.js';

// Android paints the status bar with this, so it has to follow the palette.
// Keys are storage.THEMES; css/app.css keys its palettes on the same ids.
export const THEME_BAR_COLOR = { dark: '#11131a', light: '#f5f6fa', kids: '#fff6e5' };

// Picked at random so the same word does not come back ten times in one run.
const KIDS_CHEERS = ['Yatta! ✨', 'Sugoi! 🌟', 'Nice one! 🎉', 'Yes! 🙌'];
const KIDS_MISS = 'Not quite 🙈';

export function isKids() {
  return store.getSettings().theme === 'kids';
}

export function applyTheme() {
  const theme = store.getSettings().theme;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.getElementById('theme-color');
  if (meta) meta.setAttribute('content', THEME_BAR_COLOR[theme] || THEME_BAR_COLOR.dark);
}

export function cheer() {
  return KIDS_CHEERS[Math.floor(Math.random() * KIDS_CHEERS.length)];
}

export function missLine() {
  return KIDS_MISS;
}

/** End-of-run line for the Kids theme, by the share of good answers. */
export function summaryCheer(ratio) {
  if (ratio >= 0.9) return 'Amazing! 🏆';
  if (ratio >= 0.7) return 'Great job! 🎉';
  return 'Keep going! 💪';
}
