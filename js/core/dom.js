// [MODULE] dom | Tiny DOM helpers: element builder, Japanese-text spans, toast, segmented control, labelled parts, list toolbar groups, titled list sections, one-line field that takes a pasted block, confirm seam
// [IFACE] layer: presentation | in: tag names, props, children -> out: DOM nodes | crosses: [browser DOM]
// [GRAPH] needs: [] | feeds: [shell, kana-ui, words-ui, sentences-ui, review-ui, kanji-ui, kanji-card, settings-ui] | group: presentation
// [STATE] stateless | persists: nothing | raises: nothing

/**
 * h(tag, props, ...children) builds an element. Text always goes in as text:
 * `text` sets textContent and string children become text nodes, so words the
 * learner typed can never be parsed as markup. `html` exists only for trusted
 * markup we generate ourselves (stroke-order SVGs from the build, pitch diagrams).
 *
 * Japanese text must carry lang="ja" -- on a phone set to another language,
 * kanji otherwise render in their Chinese shapes (直, 骨, 角 differ visibly).
 */

export function $(id) {
  return document.getElementById(id);
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  });
  append(el, children);
  return el;
}

function append(el, children) {
  children.flat(Infinity).forEach((child) => {
    if (child == null || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
}

/** A span (or other tag) of Japanese text. */
export function ja(text, className, tag = 'span') {
  return h(tag, { lang: 'ja', class: className, text });
}

export function button(label, onClick, className, extra) {
  return h('button', { type: 'button', class: className, onclick: onClick, ...extra }, label);
}

/** A segmented control; `onPick(value)` is called with the tapped value. */
export function segmented(options, current, onPick, label) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
    options.map((opt) => {
      const value = typeof opt === 'object' ? opt.value : opt;
      const text = typeof opt === 'object' ? opt.label : String(opt);
      return h('button', {
        type: 'button',
        'aria-pressed': String(value === current),
        onclick: () => onPick(value)
      }, text);
    }));
}

/**
 * One labelled group of a list toolbar (`.filters`, app.css): its caption above the control.
 * With `forId` the caption is a real <label> for that input.
 */
export function filterGroup(caption, control, { forId, className } = {}) {
  return h('div', { class: 'filter' + (className ? ' ' + className : '') },
    h(forId ? 'label' : 'span', { class: 'filter-label', for: forId }, caption), control);
}

/** A titled list section (`.list-group`, app.css): heading, count and a hairline, then the content. */
export function listGroup(title, count, content, { className, dataset } = {}) {
  return h('section', { class: 'list-group' + (className ? ' ' + className : ''), dataset },
    h('h2', { class: 'group-head' }, title, h('span', { class: 'sub' }, String(count))), content);
}

/** A labelled block of a card or a review step (`.part`, app.css): the label, then any content. */
export function part(label, ...content) {
  return h('div', { class: 'part' }, h('div', { class: 'part-label' }, label), content);
}

/**
 * A textarea that takes one typed line and a pasted block (P20). Enter moves to `next` instead of
 * breaking the line, so a line break in the value can only have come from a paste, whichever way
 * it arrived: the context menu, Ctrl+V, or a phone keyboard's clipboard strip (which fires no
 * paste event, hence the `input` listener). Then `onBlock(value, previous)` runs with the value the
 * field held before the paste (taken at `beforeinput`, else the last value seen, as code may have
 * set it since); when it returns false (one line after all) the line breaks are dropped. Register
 * it before the field's other `input` listeners, so they see the result.
 */
export function pasteBlockField(field, next, onBlock) {
  let previous = field.value;
  field.setAttribute('enterkeyhint', 'next');
  field.addEventListener('focus', () => { previous = field.value; });
  field.addEventListener('beforeinput', (e) => {
    previous = field.value;
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    e.preventDefault();
    next.focus();
  });
  field.addEventListener('input', () => {
    if (/[\r\n]/.test(field.value) && !onBlock(field.value, previous)) {
      field.value = field.value.replace(/[\r\n]+/g, '').trim();
    }
    previous = field.value;
  });
}

/** The one place the app asks for confirmation, so tests can answer it. */
export function confirmAction(message) {
  return window.confirm(message);
}

export function notify(message) {
  window.alert(message);
}

let toastTimer = 0;
export function toast(message) {
  let el = $('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

export function formatDaysAgo(ts, now = Date.now()) {
  if (!ts) return 'never';
  const days = Math.floor((now - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + ' days ago';
}
