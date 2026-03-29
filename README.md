# BFR — Bulk File Renamer v2.1.0

> Free, fully offline bulk file renaming tool. Runs in any modern browser. No uploads, no backend, no tracking.

---

## 📁 Directory Structure

```
bfr/
├── index.html              ← Semantic HTML5 entry point
├── manifest.json           ← PWA manifest (installable on home screen)
├── sw.js                   ← Service worker (versioned offline cache)
├── README.md
│
├── css/
│   └── styles.css          ← All styles — dark/light mode via CSS variables
│
├── js/
│   ├── script.js           ← Full application logic (JSDoc-documented)
│   └── vendor/
│       └── jszip.min.js    ← JSZip 3.10.1 (see License section)
│
└── icons/
    └── icon.svg            ← PWA icon — amber document/rename mark
```

---

## 🚀 Quick Start

### Option A — Open directly (works offline immediately)
Just open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).  
No build step. No npm. No server required.

### Option B — Serve locally (required to test PWA install)
Any static-file server works:

```bash
# Python 3
python3 -m http.server 8080

# Node.js / npx
npx serve .

# VS Code — install the "Live Server" extension, then click "Go Live"
```

Then open `http://localhost:8080` and click the **Install App** button in the header.

> **iOS Safari:** Tap the Share icon → **Add to Home Screen** — standard PWA flow.

---

## ✨ Features (v2.1)

| Feature | Description |
|---|---|
| **15 Rename Modules** | Sequence, numbering, date/time, case, find & replace, add text, remove by position, extension, random name, file size, conditional rules, duplicate handling, and more |
| **Dark / Light Mode** | Toggle with the ☀️/🌙 button; choice persists via `localStorage` |
| **Undo** | One-level undo — revert the last file-add, clear, or download session |
| **Export Rules** | Save all module settings as a dated `.json` preset file |
| **Import Rules** | Restore any saved preset in one click — no page reload needed |
| **Filename Validation** | Warns if output names contain OS-illegal chars: `\ / : * ? " < > \|` |
| **Progress Bar** | Real-time progress shown for batches of > 50 files during both preview and ZIP packing |
| **Success Toast** | After download: `"X files packed successfully — Y renamed."` |
| **XSS-safe** | All user data rendered via `.textContent` — never `.innerHTML` |
| **PWA / Offline** | Full service worker with versioned pre-cache; installable on Android and iOS |
| **JSDoc** | Every function documented with `@param`, `@returns`, and description |
| **try/catch** | Entire rename pipeline and ZIP generation are wrapped in error handlers |
| **Semantic HTML5** | Proper `<header>`, `<main>`, `<section>`, ARIA roles and labels throughout |

---

## 🔧 Module Reference

| # | Module | Overrides Base? | Notes |
|---|---|---|---|
| 1 | Find Duplicates | No | Batch-level — highlights or removes duplicate output names |
| 2 | Base Name | Partial | Custom base, strip ext, lowercase ext |
| 3 | Numbering | No | Prefix/suffix — numeric, alpha, roman |
| 4 | Add Text | No | Start, end, before-ext, or character position |
| 5 | Conditional Rules | Varies | If/then rules per-file; supports skip |
| 6 | Text Processing | No | Trim, spaces/underscores, brackets, special chars |
| 7 | Find & Replace | No | Plain text or regex; per-rule case sensitivity |
| 8 | Remove by Position | No | Trim chars from start, end, or offset |
| 9 | Case | No | lower, UPPER, Title, Sentence, camelCase, PascalCase, snake_case, kebab-case |
| 10 | Date & Time | No | Append or prepend formatted timestamp |
| 11 | File Size | No | Append or prepend size in B/KB/MB |
| 12 | Extension | No | Change, remove, lowercase, uppercase, or add |
| 13 | Random Name | **Yes** | Replaces base with UUID, hex, alpha, or word pair |
| 14 | Sequence Renaming | **Yes** | Pattern-based — `{n}` and `{name}` tokens |
| 15 | Duplicate Handling | No | Batch-level — suffix, skip, or allow conflicts |

---

## 🛡️ Security & Privacy

- **Zero data egress.** Files never leave your device; all processing is in-browser.
- **XSS-safe rendering.** Every piece of user-controlled text (filenames, rule inputs) is written via `.textContent` — never `.innerHTML`.
- **No analytics, no ads, no cookies.**

---

## 🔄 Releasing a New Version (PWA Cache Update)

To force existing installed users to download updated assets:

1. Make your changes to `css/styles.css`, `js/script.js`, etc.
2. Open `sw.js` and change `CACHE_NAME` from `'bfr-v2'` to `'bfr-v3'` (or higher).
3. Deploy. The old service worker will detect the new one, swap on next load, and the stale cache will be purged.

---

## 📄 License

### BFR Application Code
MIT License

Copyright © 2025 BFR Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

---

### Third-Party Attributions

#### JSZip v3.10.1
**File:** `js/vendor/jszip.min.js`  
**Copyright:** © 2009-2016 Stuart Knightley  
**License:** MIT License or GPLv3 (dual-licensed)  
**Source:** https://github.com/Stuk/jszip  

> JSZip is used to generate the downloadable `.zip` archive in the browser
> without any server-side processing.

#### Pako (included within JSZip)
**Copyright:** © 2014-2017 Vitaly Puzrin and Andrei Tuputcyn  
**License:** MIT License  
**Source:** https://github.com/nodeca/pako  

> Pako provides the DEFLATE compression algorithm used by JSZip internally.
> It is bundled inside `jszip.min.js` and is not a separate file.

#### Google Fonts
**Fonts used:** Space Mono, DM Sans  
**License:** SIL Open Font License 1.1  
**Source:** https://fonts.google.com  

> Fonts are loaded from Google Fonts CDN and are cached by the service worker
> for offline use after the first load.
