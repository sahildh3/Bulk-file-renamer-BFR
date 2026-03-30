BFR — Bulk File Renamer v3.0.0
> Free, fully offline bulk file renaming tool. Runs in any modern browser. No uploads, no backend, no tracking.
> 
✨ What's New in v3.0
 * File System Access API: On desktop, BFR now saves renamed files directly to your hard drive, completely bypassing browser memory limits.
 * Web Worker ZIP Engine: On mobile, ZIP generation is offloaded to a background thread with zero-copy Transferable Objects so the UI never freezes.
 * Smart Metadata Extraction: Automatically reads EXIF data from photos ({date_taken}) and ID3v2 tags from audio files ({artist}, {title}) using zero-dependency binary parsing.
 * 100% Privacy & GDPR Compliant: Removed all external network requests (including Google Fonts). Uses native system fonts to guarantee no IP leaking.
📁 Directory Structure
We've hyper-optimized the app into just 4 files for maximum portability:
bfr/
├── index.html              ← Semantic HTML5, CSS, and JS logic (Includes Web Worker & JSZip)
├── manifest.json           ← PWA manifest (installable on home screen)
├── sw.js                   ← Service worker (versioned offline cache)
└── icon.svg                ← PWA icon — scalable, maskable, and lightweight

🚀 Quick Start
Option A — Open directly (works offline immediately)
Just open index.html in any modern browser (Chrome, Edge, Firefox, Safari).
No build step. No npm. No server required.
Option B — Serve locally (required to test PWA install)
Because BFR uses advanced APIs (Service Workers, File System Access), it requires a secure context (https:// or localhost). Any static-file server works:
# Python 3
python3 -m http.server 8080

# Node.js / npx
npx serve .

# VS Code — install the "Live Server" extension, then click "Go Live"

Then open http://localhost:8080 and click the Install button in the header.
> iOS Safari: Tap the Share icon → Add to Home Screen.
> 
⚖️ Third-Party Attributions
JSZip v3.10.1
Copyright: © 2009-2016 Stuart Knightley
License: MIT License
Source: https://github.com/Stuk/jszip
> JSZip is used to generate the downloadable .zip archive in the browser without any server-side processing. It is embedded directly within index.html.
> 
Pako (included within JSZip)
Copyright: © 2014-2017 Vitaly Puzrin and Andrei Tuputcyn
License: MIT License
Source: https://github.com/nodeca/pako
> Pako provides the DEFLATE compression algorithm used by JSZip internally.
> 
