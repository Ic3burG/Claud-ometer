# Claud-ometer — Progress Log

## macOS Menu Bar App (2026-04-21)

Wrapped the Next.js dashboard as a native macOS menu bar app using Electron. Clicking the tray icon opens the full Claud-ometer dashboard in a 1200×800 window. No Dock icon — lives exclusively in the menu bar.

### Design decisions

- **Electron** chosen over Tauri (simpler setup, no Rust required) and Automator wrappers (no real tray support)
- **Next.js standalone output** (`output: 'standalone'`) produces a self-contained `server.js` that Electron forks using `utilityProcess.fork()` — no dependency on system Node.js in the packaged app
- **`outputFileTracingRoot: process.cwd()`** added to `next.config.ts` so the standalone server lands at `.next/standalone/server.js` directly rather than a nested machine-specific path
- **`findServerJs()`** walks the standalone directory recursively (skipping `node_modules`) to locate the server — handles any Next.js output structure robustly
- **`app.setActivationPolicy('accessory')`** makes it a true menu-bar-only app on macOS (no Cmd+Tab, no Dock)
- Tray icon is a 22×22 RGBA PNG (ascending bar chart shape) with `setTemplateImage(true)` — macOS auto-inverts for light/dark mode

### Files added / changed

| File | Change |
|------|--------|
| `next.config.ts` | Added `output: 'standalone'` and `outputFileTracingRoot: process.cwd()` |
| `electron/main.ts` | Electron main process — tray, window, server lifecycle |
| `electron/tsconfig.json` | Separate TypeScript config targeting CommonJS for Electron |
| `electron/assets/tray-icon.png` | 22×22 RGBA ascending bar chart template icon |
| `package.json` | Added `"main"`, `electron:dev`, `electron:build` scripts, and electron-builder `"build"` config |
| `.gitignore` | Added `/dist-electron/` and `/dist/` |
| `docs/superpowers/specs/2026-04-21-macos-menu-bar-app-design.md` | Design spec |
| `docs/superpowers/plans/2026-04-21-macos-menu-bar-app.md` | Implementation plan |

### Commits

```
f7d62fe fix(electron): add outputFileTracingRoot to normalize standalone server path
0889d31 fix(electron): replace speedometer icon with clean ascending bar chart
3a20b71 fix(electron): replace solid black icon with RGBA speedometer template image
a2f947e fix(electron): dynamically locate standalone server.js (handles nested Next.js output path)
af97fbe fix(electron): use unknown type in catch handler
2aa4181 fix(electron): add response.ok check, startup error handling, inherit server stdio
9b639f0 feat(electron): add main process — tray icon, window, server management
4db5cff feat(electron): add 22x22 grayscale tray icon
864bb7d feat(electron): add electron/ TypeScript config (CommonJS target)
1370b8b feat(electron): add build config, scripts, and gitignore entries
6b3c5e2 feat(electron): add electron and electron-builder devDependencies
5c47446 feat(electron): enable standalone output for Next.js
```

### How to build and run

```bash
# Dev (full build + launch — ~60s first time):
npm run electron:dev

# Package to .app:
npm run electron:build
# Output: dist/mac-arm64/Claud-ometer.app

# Install (first time — clears Gatekeeper quarantine):
xattr -cr dist/mac-arm64/Claud-ometer.app
cp -r dist/mac-arm64/Claud-ometer.app /Applications/
```

### Known issues fixed during implementation

- **Nested standalone path**: Next.js mirrors the project's absolute path inside the standalone directory by default. Fixed with `outputFileTracingRoot` + `findServerJs()`.
- **Stale compiled output**: subagents compiled with `--noEmit` (type-check only) but didn't regenerate `dist-electron/main.js`. Fixed by running `tsc -p electron/` explicitly before launch.
- **Invisible tray icon**: original grayscale PNG had no alpha channel — macOS template images require RGBA with transparent background. Fixed with RGBA icon.

### To add to Login Items (auto-start on login)

System Settings → General → Login Items → add `/Applications/Claud-ometer.app`

---

## Prior work

- `e868358` — Initial build: local-first Claude Code analytics dashboard (Next.js 16, React 19, Tailwind v4, shadcn/ui, Recharts)
- `c0a2755` — Defensive data access, URL-persisted search, CLAUDE.md
- `dbdf7c2` — Dark theme default, session search, descending sort
- `bde5517` — Fix stale overview data via stats-cache.json
- `7225aeb` — Fix GitHub issues #2–5
- `9d24db3` — Cost modes feature
- `18be28b` — Fix history.replaceState() infinite loop on Sessions page
