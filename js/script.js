/**
 * BFR — Bulk File Renamer | script.js v2.1.0
 *
 * Architecture: vanilla JS, zero dependencies beyond JSZip (loaded separately).
 * All rename logic runs client-side — no file data ever leaves the browser.
 *
 * Module execution order inside renameSingle():
 *   2 (base) → 13 (random) → 14 (sequence) → 5 (conditional) →
 *   6 (text processing) → 7 (find & replace) → 8 (remove by position) →
 *   9 (case) → 4 (add text) → 3 (numbering) → 10 (date) → 11 (size) → 12 (ext)
 *
 * Modules 1 (find duplicates) and 15 (duplicate handling) are applied in
 * applyPreview() after the per-file pipeline, as they operate across the
 * full output name set.
 *
 * @module BFR
 */

'use strict';

// ============================================================
// STATE
// ============================================================

/** @type {File[]} Currently loaded files */
let files = [];

/** @type {string[]} Computed renamed output names — parallel array to `files` */
let renamedNames = [];

/** @type {{ files: File[], renamedNames: string[] } | null} One-level undo snapshot */
let undoSnapshot = null;

/** @type {Object.<string, string>} Stable random-name cache keyed by seed string */
const randomCache = {};

/** @type {number} Auto-incrementing ID counter for replace rule rows */
let replaceRuleCount = 0;

/** @type {number} Auto-incrementing ID counter for conditional rule rows */
let condRuleCount = 0;

/** @type {'dark'|'light'} Active UI theme */
let currentTheme = localStorage.getItem('bfr-theme') || 'dark';

/**
 * Regex of characters illegal in filenames on Windows and common file systems.
 * Characters: \ / : * ? " < > |
 */
const ILLEGAL_CHARS = /[\\/:*?"<>|]/;

// ============================================================
// THEME
// ============================================================

/**
 * Toggle between dark and light theme and persist the preference.
 */
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme();
  localStorage.setItem('bfr-theme', currentTheme);
}

/**
 * Apply `currentTheme` to the document root attribute and update UI icons.
 */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);

  const metaTheme = document.getElementById('meta-theme-color');
  if (metaTheme) {
    metaTheme.setAttribute('content', currentTheme === 'dark' ? '#0f0e0d' : '#f5f3f0');
  }

  const darkIcon  = document.getElementById('theme-icon-dark');
  const lightIcon = document.getElementById('theme-icon-light');
  if (darkIcon && lightIcon) {
    darkIcon.style.display  = currentTheme === 'dark'  ? 'block' : 'none';
    lightIcon.style.display = currentTheme === 'light' ? 'block' : 'none';
  }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

/**
 * Display a self-dismissing toast notification.
 *
 * @param {string}                        message  - Text to show (rendered via textContent, XSS-safe).
 * @param {'success'|'error'|'info'|'warn'} [type='info'] - Visual style.
 * @param {number}                        [duration=2800] - Auto-dismiss delay in ms.
 */
function showToast(message, type = 'info', duration = 2800) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className   = 'toast toast-' + type;
  toast.textContent = message; // textContent — never innerHTML — for XSS safety

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut .25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

// ============================================================
// FILENAME VALIDATION
// ============================================================

/**
 * Check all proposed output filenames for illegal characters.
 * Updates the visible validation warning bar.
 *
 * @param {string[]} names - Array of proposed output filenames.
 * @returns {boolean} `true` if all names are valid; `false` if any contain illegal chars.
 */
function validateFilenames(names) {
  const warn = document.getElementById('validation-warning');
  if (!warn) return true;

  const bad = names.filter(n => ILLEGAL_CHARS.test(n));

  if (bad.length === 0) {
    warn.style.display = 'none';
    warn.textContent   = '';
    return true;
  }

  warn.style.display = 'block';
  // textContent prevents XSS; bad[0] comes from user-defined rename rules
  warn.textContent =
    `⚠ ${bad.length} filename(s) contain illegal characters ( \\ / : * ? " < > | ). ` +
    `Example: "${bad[0]}"`;
  return false;
}

// ============================================================
// UNDO
// ============================================================

/**
 * Save a shallow snapshot of `files` and `renamedNames` for one-level undo.
 * Enables the Undo button in the header.
 */
function saveUndoSnapshot() {
  undoSnapshot = { files: [...files], renamedNames: [...renamedNames] };
  const btn = document.getElementById('undo-btn');
  if (btn) btn.disabled = false;
}

/**
 * Restore `files` and `renamedNames` from the last saved snapshot.
 * Clears the snapshot and disables the Undo button afterward.
 */
function undoRename() {
  if (!undoSnapshot) return;

  files        = undoSnapshot.files;
  renamedNames = undoSnapshot.renamedNames;
  undoSnapshot = null;

  const btn = document.getElementById('undo-btn');
  if (btn) btn.disabled = true;

  renderFileList();
  applyPreview();
  showToast('↩ Undone — file list restored', 'info');
}

// ============================================================
// RULE PRESETS (Export / Import)
// ============================================================

/**
 * Collect the current value of every module control into a plain object.
 *
 * @returns {{ version: number, modules: Object.<string, boolean|string> }}
 */
function collectPreset() {
  const preset = { version: 2, modules: {} };

  const ids = [
    'mod1-enabled', 'mod1-mode', 'mod1-action',
    'mod2-mode', 'mod2-custom',
    'mod3-enabled', 'mod3-mode', 'mod3-style', 'mod3-sep',
    'mod3-start', 'mod3-inc', 'mod3-pad',
    'mod4-enabled', 'mod4-text', 'mod4-pos', 'mod4-charpos',
    'mod5-enabled',
    'mod6-enabled', 'mod6-trim', 'mod6-dbl-space', 'mod6-underscore',
    'mod6-hyphen', 'mod6-dots', 'mod6-spaces-underscore',
    'mod6-special', 'mod6-brackets',
    'mod7-enabled',
    'mod8-enabled', 'mod8-from', 'mod8-count', 'mod8-pos',
    'mod9-enabled', 'mod9-style', 'mod9-scope',
    'mod10-enabled', 'mod10-pos', 'mod10-fmt', 'mod10-custom', 'mod10-sep',
    'mod11-enabled', 'mod11-pos', 'mod11-unit', 'mod11-sep',
    'mod12-enabled', 'mod12-action', 'mod12-ext',
    'mod13-enabled', 'mod13-type', 'mod13-len',
    'mod14-enabled', 'mod14-pattern', 'mod14-start', 'mod14-pad',
    'mod15-action', 'mod15-fmt',
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    preset.modules[id] = el.type === 'checkbox' ? el.checked : el.value;
  });

  return preset;
}

/**
 * Serialise current module rules to JSON and trigger a browser download.
 */
function exportPreset() {
  try {
    const json   = JSON.stringify(collectPreset(), null, 2);
    const blob   = new Blob([json], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href     = url;
    anchor.download = 'bfr-preset-' + new Date().toISOString().slice(0, 10) + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('✓ Rules exported as JSON', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

/**
 * Read a JSON preset file selected by the user and apply it to all module controls.
 *
 * @param {Event} event - The `change` event from the hidden file input.
 */
function importPreset(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const preset = JSON.parse(e.target.result);
      if (!preset || !preset.modules) throw new Error('Invalid preset format — missing modules key.');

      Object.entries(preset.modules).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = Boolean(val);
        else el.value = String(val);
        el.dispatchEvent(new Event('change'));
      });

      applyPreview();
      showToast('✓ Rules imported successfully', 'success');
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error', 5000);
    }
    event.target.value = ''; // allow re-importing same file
  };

  reader.readAsText(file);
}

// ============================================================
// FILE MANAGEMENT
// ============================================================

/**
 * Handle the file-input `change` event — delegates to addFiles().
 * @param {Event} e
 */
function handleFileSelect(e) {
  addFiles(Array.from(e.target.files));
  e.target.value = '';
}

/**
 * Prevent default drag behaviour and highlight the drop zone.
 * @param {DragEvent} e
 */
function onDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('drag-over');
}

/**
 * Remove drop-zone highlight when drag leaves.
 * @param {DragEvent} e
 */
function onDragLeave(e) {
  document.getElementById('dropzone').classList.remove('drag-over');
}

/**
 * Handle a file drop onto the drop zone.
 * @param {DragEvent} e
 */
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files));
}

/**
 * Merge an array of File objects into the session list, skipping true duplicates
 * (matched by name + size).
 *
 * @param {File[]} newFiles - Files to add.
 */
function addFiles(newFiles) {
  saveUndoSnapshot();
  const existing = new Set(files.map(f => f.name + f.size));
  newFiles.forEach(f => {
    if (!existing.has(f.name + f.size)) {
      files.push(f);
      existing.add(f.name + f.size);
    }
  });
  renderFileList();
  applyPreview();
}

/**
 * Remove a single file from the session list by index.
 *
 * @param {number} index - Zero-based index of the file to remove.
 */
function removeFile(index) {
  saveUndoSnapshot();
  files.splice(index, 1);
  renderFileList();
  applyPreview();
}

/**
 * Visually select all file rows (highlight only — does not affect rename).
 */
function selectAllFiles() {
  document.querySelectorAll('.file-item').forEach(el => el.classList.add('selected'));
}

/**
 * Remove all loaded files and reset derived state.
 */
function clearAll() {
  if (files.length) saveUndoSnapshot();
  files        = [];
  renamedNames = [];
  renderFileList();
  applyPreview();
}

/**
 * Re-render the file list panel from the current `files` array.
 * Uses DOM API (textContent only) — no innerHTML on user data.
 */
function renderFileList() {
  const list     = document.getElementById('file-list');
  const countEl  = document.getElementById('file-count-num');
  const statEl   = document.getElementById('stat-total');
  if (!list) return;

  if (countEl) countEl.textContent = files.length;
  if (statEl)  statEl.textContent  = files.length + ' files';
  updateLimitWarning();

  if (files.length === 0) {
    list.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
           stroke="var(--text)" stroke-width="1.2" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8"  y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>`;
    const p = document.createElement('p');
    p.textContent = 'No files loaded yet.\nDrop files above to start.';
    empty.appendChild(p);
    list.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();

  files.forEach((f, i) => {
    const ext  = getExt(f.name).toLowerCase();
    const item = document.createElement('div');
    item.className   = 'file-item';
    item.dataset.idx = String(i);
    item.setAttribute('role', 'listitem');

    // File-type icon
    const icon = document.createElement('div');
    icon.className   = 'file-icon ft-' + (ext || 'default');
    icon.textContent = ext ? ext.slice(0, 3).toUpperCase() : '?';
    icon.setAttribute('aria-hidden', 'true');

    // Filename
    const nameEl = document.createElement('div');
    nameEl.className   = 'file-name';
    nameEl.textContent = f.name; // textContent — XSS-safe
    nameEl.title       = f.name;

    // Size
    const sizeEl = document.createElement('div');
    sizeEl.className   = 'file-size';
    sizeEl.textContent = formatSize(f.size);

    // Remove button
    const rm = document.createElement('button');
    rm.className = 'file-remove';
    rm.setAttribute('aria-label', 'Remove ' + f.name);
    rm.textContent = '×';
    rm.addEventListener('click', (e) => { e.stopPropagation(); removeFile(i); });

    item.append(icon, nameEl, sizeEl, rm);
    frag.appendChild(item);
  });

  list.innerHTML = '';
  list.appendChild(frag);
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Extract the extension from a filename (without leading dot).
 *
 * @param {string} name - Filename string.
 * @returns {string} Extension, or empty string if none.
 */
function getExt(name) {
  const i = name.lastIndexOf('.');
  return (i > 0 && i < name.length - 1) ? name.slice(i + 1) : '';
}

/**
 * Extract the base name from a filename (everything before the last dot).
 *
 * @param {string} name - Filename string.
 * @returns {string} Base name.
 */
function getBase(name) {
  const i = name.lastIndexOf('.');
  return (i > 0 && i < name.length - 1) ? name.slice(0, i) : name;
}

/**
 * Format a byte count as a human-readable string (B / KB / MB / GB).
 *
 * @param {number} bytes - File size in bytes.
 * @returns {string} Formatted string, e.g. `"1.4 MB"`.
 */
function formatSize(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

/**
 * Nudge a numeric `<input>` value by `delta`, clamped to the element's min/max.
 *
 * @param {string} id    - Element ID of the number input.
 * @param {number} delta - Signed delta to apply (+1 or -1).
 */
function adjustNum(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = parseInt(el.value) || 0;
  const min = el.min !== '' ? parseInt(el.min) : -Infinity;
  const max = el.max !== '' ? parseInt(el.max) :  Infinity;
  el.value = Math.min(max, Math.max(min, val + delta));
  el.dispatchEvent(new Event('input'));
}

// ============================================================
// MODULE UI
// ============================================================

/**
 * Toggle a module accordion open or closed.
 *
 * @param {number} num - Module number (1–15).
 */
function toggleModule(num) {
  const mod = document.getElementById('mod-' + num);
  if (!mod) return;
  mod.classList.toggle('open');
  const header = mod.querySelector('.module-header');
  if (header) header.setAttribute('aria-expanded', String(mod.classList.contains('open')));
}

/**
 * Collapse every open module accordion.
 */
function collapseAll() {
  document.querySelectorAll('.module.open').forEach(m => m.classList.remove('open'));
}

// Module 2 — show/hide custom name field
document.getElementById('mod2-mode').addEventListener('change', function () {
  const wrap = document.getElementById('mod2-custom-wrap');
  if (wrap) wrap.style.display = this.value === 'custom' ? 'block' : 'none';
  applyPreview();
});

// Module 4 — show/hide character position field
document.getElementById('mod4-pos').addEventListener('change', function () {
  const wrap = document.getElementById('mod4-charpos-wrap');
  if (wrap) wrap.style.display = this.value === 'pos' ? 'block' : 'none';
  applyPreview();
});

// Module 10 — show/hide custom format field + live date preview
document.getElementById('mod10-fmt').addEventListener('change', function () {
  const wrap = document.getElementById('mod10-custom-wrap');
  if (wrap) wrap.style.display = this.value === 'custom' ? 'block' : 'none';
  updateDatePreview();
  applyPreview();
});
document.getElementById('mod10-custom').addEventListener('input', function () {
  updateDatePreview();
  applyPreview();
});

/**
 * Refresh the live date format preview hint below the format selector.
 */
function updateDatePreview() {
  const el    = document.getElementById('mod10-preview');
  const fmtEl = document.getElementById('mod10-fmt');
  const cusEl = document.getElementById('mod10-custom');
  if (!el || !fmtEl) return;
  const fmt = fmtEl.value === 'custom' ? cusEl.value : fmtEl.value;
  el.textContent = 'Preview: ' + formatDate(new Date(), fmt);
}

/**
 * Insert a date token at the cursor position in the custom date format input.
 *
 * @param {string} token - Token string such as `'YYYY'` or `'MM'`.
 */
function insertDateToken(token) {
  const el = document.getElementById('mod10-custom');
  if (!el) return;
  const s = el.selectionStart;
  const e = el.selectionEnd;
  el.value = el.value.slice(0, s) + token + el.value.slice(e);
  el.selectionStart = el.selectionEnd = s + token.length;
  el.dispatchEvent(new Event('input'));
}

// Module 12 — show/hide new-extension field based on action
document.getElementById('mod12-action').addEventListener('change', function () {
  const wrap = document.getElementById('mod12-ext-wrap');
  if (wrap) wrap.style.display = ['change', 'add'].includes(this.value) ? 'block' : 'none';
  applyPreview();
});

// Module 13 — hide length control when type is 'words' (length is N/A)
document.getElementById('mod13-type').addEventListener('change', function () {
  const wrap = document.getElementById('mod13-len-wrap');
  if (wrap) wrap.style.display = this.value === 'words' ? 'none' : 'block';
  applyPreview();
});

// ============================================================
// CONDITIONAL RULES — Module 5
// ============================================================

/**
 * Dynamically append a new conditional rule row to Module 5.
 * Each row consists of a condition selector, a value input, and an action selector.
 */
function addCondRule() {
  condRuleCount++;
  const id   = condRuleCount;
  const list = document.getElementById('cond-rules-list');
  if (!list) return;

  const div = document.createElement('div');
  div.className = 'cond-rule';
  div.id        = 'cond-rule-' + id;

  // ── Header row ──
  const header = document.createElement('div');
  header.className = 'cond-rule-header';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:12px;color:var(--text2)';
  label.textContent   = 'Rule #' + id;

  const delBtn = document.createElement('button');
  delBtn.className = 'del-btn';
  delBtn.textContent = '×';
  delBtn.setAttribute('aria-label', 'Remove conditional rule ' + id);
  delBtn.addEventListener('click', () => { div.remove(); applyPreview(); });

  header.append(label, delBtn);

  // ── Condition / value row ──
  const condRow = document.createElement('div');
  condRow.className = 'field-row';

  const condSel = createSelect('cr' + id + '-cond', [
    ['contains', 'Contains'],
    ['starts',   'Starts with'],
    ['ends',     'Ends with'],
    ['matches',  'Matches regex'],
    ['ext',      'Extension is'],
  ]);
  condSel.addEventListener('change', applyPreview);

  const valInput = document.createElement('input');
  valInput.type        = 'text';
  valInput.className   =
