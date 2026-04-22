# macOS Menu Bar App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap Claud-ometer in Electron so it runs as a macOS menu bar app — clicking the tray icon opens a 1200×800 window showing the existing Next.js dashboard.

**Architecture:** Electron main process forks the Next.js standalone server (`utilityProcess.fork`) on port 3001, then polls until the server responds before creating a `Tray` icon and a hidden `BrowserWindow`. Clicking the tray icon toggles the window's visibility, positioned directly below the icon.

**Tech Stack:** Electron 33, electron-builder 25, Next.js standalone output mode (`output: 'standalone'`), TypeScript compiled to CommonJS for the Electron main process.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `next.config.ts` | Add `output: 'standalone'` |
| Modify | `package.json` | Add `main`, Electron scripts, electron-builder config |
| Modify | `.gitignore` | Ignore `dist-electron/` and `dist/` |
| Create | `electron/tsconfig.json` | TypeScript config for Electron (CommonJS output) |
| Create | `electron/assets/tray-icon.png` | 22×22 grayscale template icon |
| Create | `electron/main.ts` | Tray + BrowserWindow + server management |

---

### Task 1: Enable Next.js standalone output

**Files:**
- Modify: `next.config.ts`

This adds `output: 'standalone'` which tells Next.js to produce a self-contained `server.js` in `.next/standalone/` during `next build`. The Electron main process will fork this script using its bundled Node.js runtime.

- [ ] **Step 1: Edit next.config.ts**

Replace the entire file with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat(electron): enable standalone output for Next.js"
```

---

### Task 2: Install Electron dependencies

**Files:**
- Modify: `package.json` (devDependencies only)

- [ ] **Step 1: Install packages**

```bash
npm install --save-dev electron@33 electron-builder@25
```

- [ ] **Step 2: Verify install**

```bash
npx electron --version
```

Expected output: `v33.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(electron): add electron and electron-builder devDependencies"
```

---

### Task 3: Update .gitignore and package.json main + scripts

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Add Electron build outputs to .gitignore**

Append to `.gitignore`:

```
# electron
/dist-electron/
/dist/
```

- [ ] **Step 2: Add `main` field and scripts to package.json**

In `package.json`, add `"main": "dist-electron/main.js"` at the top level (alongside `"name"`, `"version"`, etc.), and add these three scripts to the `"scripts"` block:

```json
"electron:dev": "next build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && tsc -p electron/ && cp -r electron/assets dist-electron/ && electron .",
"electron:build": "next build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && tsc -p electron/ && cp -r electron/assets dist-electron/ && electron-builder"
```

- [ ] **Step 3: Add electron-builder config block to package.json**

Add a top-level `"build"` key to `package.json`:

```json
"build": {
  "appId": "com.ojdavis.claud-ometer",
  "productName": "Claud-ometer",
  "mac": {
    "category": "public.app-category.developer-tools",
    "target": [{ "target": "dir" }]
  },
  "directories": {
    "output": "dist"
  },
  "files": [
    "dist-electron/**/*"
  ],
  "extraResources": [
    { "from": ".next/standalone", "to": "standalone" },
    { "from": ".next/static",     "to": "standalone/.next/static" },
    { "from": "public",           "to": "standalone/public" }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json
git commit -m "feat(electron): add build config, scripts, and gitignore entries"
```

---

### Task 4: Create Electron TypeScript config

**Files:**
- Create: `electron/tsconfig.json`

The `electron/` directory uses CommonJS modules (required by Electron's main process) with output going to `dist-electron/`. This is intentionally separate from the root `tsconfig.json` which targets ESM for Next.js.

- [ ] **Step 1: Create the electron directory**

```bash
mkdir -p electron
```

- [ ] **Step 2: Create electron/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "../dist-electron",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 3: Verify TypeScript can find Electron types**

```bash
cd electron && npx tsc --noEmit -p tsconfig.json 2>&1| head -5
```

Expected: no output (or only warnings, no errors). If you see `Cannot find module 'electron'`, run `npm install` from the project root first.

- [ ] **Step 4: Commit**

```bash
git add electron/tsconfig.json
git commit -m "feat(electron): add electron/ TypeScript config (CommonJS target)"
```

---

### Task 5: Create the tray icon

**Files:**
- Create: `electron/assets/tray-icon.png`

macOS menu bar template images must be a grayscale (black) PNG — the OS inverts them for dark mode automatically. The icon is 22×22 pixels. We generate it with Python 3 (ships with macOS) using raw PNG byte construction — no external dependencies needed.

- [ ] **Step 1: Create assets directory and generate icon**

```bash
mkdir -p electron/assets
python3 -c "
import struct, zlib

def chunk(tag, data):
    raw = tag + data
    return struct.pack('>I', len(data)) + raw + struct.pack('>I', zlib.crc32(raw) & 0xffffffff)

w, h = 22, 22
sig  = b'\x89PNG\r\n\x1a\n'
ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0))  # 8-bit grayscale
rows = b''.join(b'\x00' + b'\x00' * w for _ in range(h))              # all black pixels
idat = chunk(b'IDAT', zlib.compress(rows))
iend = chunk(b'IEND', b'')
with open('electron/assets/tray-icon.png', 'wb') as f:
    f.write(sig + ihdr + idat + iend)
print('Icon created: electron/assets/tray-icon.png')
"
```

- [ ] **Step 2: Verify the file was created**

```bash
file electron/assets/tray-icon.png
```

Expected: `electron/assets/tray-icon.png: PNG image data, 22 x 22, 8-bit grayscale, non-interlaced`

- [ ] **Step 3: Commit**

```bash
git add electron/assets/tray-icon.png
git commit -m "feat(electron): add 22x22 grayscale tray icon"
```

---

### Task 6: Create electron/main.ts

**Files:**
- Create: `electron/main.ts`

This is the entire Electron main process. It:
1. Hides the Dock icon and sets activation policy to `accessory` (menu-bar-only app)
2. Forks the Next.js standalone server via `utilityProcess.fork`
3. Polls `http://127.0.0.1:3001/api/stats` until the server responds (up to 15 s)
4. Creates a hidden `BrowserWindow` loading the app
5. Creates a `Tray` icon that toggles the window on click; right-click shows a Quit option
6. Hides the window when it loses focus

- [ ] **Step 1: Create electron/main.ts**

```typescript
import { app, BrowserWindow, Menu, Tray, nativeImage, utilityProcess } from 'electron'
import type { UtilityProcess } from 'electron'
import path from 'path'

const PORT = 3001
let tray: Tray | null = null
let win: BrowserWindow | null = null
let server: UtilityProcess | null = null

function getServerPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'standalone', 'server.js')
    : path.join(app.getAppPath(), '.next', 'standalone', 'server.js')
}

function getIconPath(): string {
  return app.isPackaged
    ? path.join(__dirname, 'assets', 'tray-icon.png')
    : path.join(app.getAppPath(), 'electron', 'assets', 'tray-icon.png')
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/api/stats`)
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
  throw new Error('Claud-ometer server did not start within 15 seconds')
}

function startServer(): void {
  server = utilityProcess.fork(getServerPath(), [], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
  })
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  win.loadURL(`http://127.0.0.1:${PORT}`)
  win.on('blur', () => win?.hide())
}

function positionWindow(): void {
  if (!tray || !win) return
  const { x, y, width, height } = tray.getBounds()
  const { width: winW } = win.getBounds()
  win.setPosition(Math.round(x + width / 2 - winW / 2), y + height + 4)
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getIconPath())
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Claud-ometer')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Quit Claud-ometer', click: () => app.quit() },
    ])
  )
  tray.on('click', () => {
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      positionWindow()
      win.show()
      win.focus()
    }
  })
}

if (process.platform === 'darwin') {
  app.dock.hide()
  app.setActivationPolicy('accessory')
}

app.on('window-all-closed', () => {
  // Do not quit — this is a menu bar app with no visible windows at rest
})

app.on('before-quit', () => server?.kill())

app.whenReady().then(async () => {
  startServer()
  await waitForServer()
  createWindow()
  createTray()
})
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

```bash
tsc -p electron/tsconfig.json --noEmit
```

Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat(electron): add main process — tray icon, window, server management"
```

---

### Task 7: Smoke-test with electron:dev

**Files:** none (runtime verification only)

This step confirms the full chain works end-to-end before packaging.

- [ ] **Step 1: Run the dev build**

```bash
npm run electron:dev
```

This takes ~60–90 seconds (Next.js build + TS compilation). When it completes, a small icon should appear in the macOS menu bar.

- [ ] **Step 2: Verify expected behavior**

- Click the menu bar icon → 1200×800 window appears below it showing the Claud-ometer dashboard
- Click elsewhere → window hides
- Click the icon again → window reappears
- Right-click the icon → context menu appears with "Quit Claud-ometer"
- No Dock icon is visible; app does not appear in Cmd+Tab

- [ ] **Step 3: Quit via context menu and confirm process exits cleanly**

Right-click the tray icon → "Quit Claud-ometer". Verify no orphaned `node` processes:

```bash
pgrep -la node | grep standalone
```

Expected: no output (server process was killed by `before-quit` handler).

- [ ] **Step 4: Commit**

No code changes in this task. If you had to fix something to get this step working, commit those fixes now with a descriptive message before continuing.

---

### Task 8: Package and install to /Applications

**Files:** none (build output only)

`target: "dir"` produces `dist/mac-arm64/Claud-ometer.app` (or `mac` on Intel). No DMG is created — just drag the `.app` to `/Applications`.

- [ ] **Step 1: Run the production build**

```bash
npm run electron:build
```

Expected: build completes and `dist/` directory is created. The last few lines of output should include something like:
```
  • building        target=dir arch=arm64 file=dist/mac-arm64/Claud-ometer.app
  • application     directory=dist/mac-arm64/Claud-ometer.app
```

- [ ] **Step 2: Verify the .app exists**

```bash
ls dist/*/Claud-ometer.app
```

Expected: path is printed without error.

- [ ] **Step 3: Bypass Gatekeeper (first time only)**

macOS will block an unsigned app. To open it once:

```bash
xattr -cr dist/*/Claud-ometer.app
```

Then double-click `dist/mac-arm64/Claud-ometer.app` (or right-click → Open if Gatekeeper still prompts).

- [ ] **Step 4: Install to /Applications**

```bash
cp -r dist/*/Claud-ometer.app /Applications/
```

- [ ] **Step 5: Launch and verify**

Open Spotlight (Cmd+Space), type "Claud-ometer", press Enter. The menu bar icon should appear within ~10 seconds (server warm-up). Click it to confirm the dashboard loads.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(electron): packaging complete — menu bar app ships as Claud-ometer.app"
```

---

## Notes

- **No automated tests** — the Electron main process is thin infrastructure (tray, window, process lifecycle). Verification is the smoke-test in Task 7.
- **Loading state simplification** — the spec described a "Starting…" placeholder window. Instead, this plan blocks `createTray()` until the server responds (`waitForServer`), so the tray icon doesn't appear until the app is ready (~10s cold start). This is cleaner UX: no loading state needed because the icon appears only when the app is actually usable.
- **Rebuilding after code changes:** re-run `npm run electron:build` and re-copy to `/Applications`.
- **To add to Login Items:** System Settings → General → Login Items → add `/Applications/Claud-ometer.app`.
- **Port conflict:** if port 3001 is already in use, the server will fail silently. Change `PORT` in `electron/main.ts` if needed.
