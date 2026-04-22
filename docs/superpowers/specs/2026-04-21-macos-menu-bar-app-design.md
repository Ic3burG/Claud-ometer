# macOS Menu Bar App — Design Spec

**Date:** 2026-04-21
**Status:** Approved

## Summary

Wrap Claud-ometer (Next.js 16 local-first dashboard) as a native macOS menu bar app using Electron. Clicking the tray icon opens a full window; the Next.js server runs inside Electron's main process via the programmatic API. Personal use only — no code signing or notarization required.

---

## Architecture

The Next.js app runs as an HTTP server inside the Electron main process using the Next.js programmatic API (`next()` + `http.createServer`). This avoids child process / PATH / Node.js binary issues — Electron's bundled Node.js runs the server directly.

```
Electron app (.app bundle)
├── main process
│   ├── starts Next.js server on port 3001 (programmatic API)
│   ├── creates Tray icon (menu bar)
│   └── manages BrowserWindow (show/hide on tray click)
└── renderer (BrowserWindow)
    └── loads http://localhost:3001  →  existing Next.js app (unchanged)
```

The Next.js source code requires **zero changes**. The `~/.claude/` filesystem reads continue to work identically.

---

## File Changes

### New files

```
electron/
  main.ts          # Main Electron process (tray + window + server)
  tsconfig.json    # Separate TS config (CommonJS target for Node/Electron)
  assets/
    tray-icon.png  # 22×22px template image (white/black, no color)
```

### Modified files

- `package.json` — add Electron devDependencies + new scripts
- No changes to `next.config.ts` or any Next.js source files

### New scripts

```bash
npm run electron:dev    # next build && electron .
npm run electron:build  # next build && tsc -p electron/ && electron-builder
```

---

## Window Behavior

- **No dock icon** — `app.dock.hide()` + `app.setActivationPolicy('accessory')` — app lives exclusively in the menu bar, does not appear in Cmd+Tab
- **Show/hide toggle** — clicking the tray icon shows the window if hidden, hides it if visible
- **Auto-hide on blur** — window hides when it loses focus
- **Positioning** — window appears directly below the tray icon, horizontally centered on it
- **Window size** — 1200×800, resizable, no position persistence in v1
- **Loading state** — window shows a simple inline "Starting…" message while the Next.js server warms up, then navigates to the app once the server is ready (polled via `fetch`)

---

## Packaging

### electron-builder config (in `package.json`)

- Target: `dmg` + `dir` → produces `dist/Claud-ometer.app`
- `asar: true` — bundles source into a single archive
- App ID: `com.ojdavis.claud-ometer`
- No code signing — personal use only

### Build flow

```
npm run electron:build
  1. next build          → .next/
  2. tsc -p electron/    → dist-electron/main.js
  3. electron-builder    → dist/Claud-ometer.app
```

### First-time macOS setup

1. Right-click `dist/Claud-ometer.app` → Open (bypasses Gatekeeper once)
2. Drag to `/Applications`
3. Launch via Spotlight as "Claud-ometer"

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  }
}
```

No new runtime dependencies — Electron's bundled Node.js handles the server.

---

## Out of Scope (v1)

- Window position/size persistence
- Auto-launch at login
- Auto-updater
- Code signing / notarization
- Context menu on tray icon (quit option can be added via right-click later)
