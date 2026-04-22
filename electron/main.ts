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
      const res = await fetch(`http://127.0.0.1:${PORT}/api/stats`)
      if (res.ok) return
    } catch {
      // server not yet ready
    }
    await new Promise(resolve => setTimeout(resolve, 300))
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
    stdio: 'inherit',
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
}).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('Claud-ometer failed to start:', message)
  app.quit()
})
