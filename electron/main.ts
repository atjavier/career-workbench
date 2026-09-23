import { app, BrowserWindow, Menu, dialog, shell, ipcMain } from "electron";
import * as path from "node:path";
import { ServerManager } from "./server-manager";

// Disable Chromium OS-level sandbox in unpackaged development mode to prevent macOS sandbox extension errors
if (!app.isPackaged) {
  app.commandLine.appendSwitch("no-sandbox");
}

let mainWindow: BrowserWindow | null = null;
let serverManager: ServerManager | null = null;
let isQuitting = false;

// 1. Single Instance Lock Enforcement
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running; terminate this secondary process immediately
  app.quit();
} else {
  app.on("second-instance", () => {
    // When a second instance launch is attempted, bring existing window to focus
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  initApp();
}

function initApp(): void {
  const isDev = process.env.NODE_ENV === "development" || process.env.ELECTRON_DEV === "1";
  serverManager = new ServerManager({ isDev });

  app.whenReady().then(async () => {
    setupIpcHandlers();
    setupApplicationMenu();
    createMainWindow();

    try {
      if (serverManager && mainWindow) {
        const baseUrl = await serverManager.start();
        if (!mainWindow.isDestroyed()) {
          await mainWindow.loadURL(baseUrl);
        }
      }
    } catch (err) {
      console.error("Failed to start embedded Next.js server:", err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        dialog.showErrorBox(
          "Startup Error",
          `Career Workbench failed to start the local service:\n\n${errorMessage}`
        );
      }
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  app.on("before-quit", async (event) => {
    if (!isQuitting) {
      isQuitting = true;
      event.preventDefault();

      const forceExitTimer = setTimeout(() => {
        app.exit(0);
      }, 2000);

      if (serverManager) {
        try {
          await serverManager.stop();
        } catch (err) {
          console.error("Error shutting down local server:", err);
        }
      }

      clearTimeout(forceExitTimer);
      app.exit(0);
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

function createMainWindow(): void {
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: "Career Workbench",
    titleBarStyle: "default",
    show: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  // Display clean initial loading state
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Career Workbench</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f8fafc;
              color: #0f172a;
            }
            .spinner {
              width: 32px;
              height: 32px;
              border: 3px solid #e2e8f0;
              border-top-color: #2563eb;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin-bottom: 16px;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            h1 { font-size: 16px; font-weight: 500; margin: 0; }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <h1>Starting Career Workbench...</h1>
        </body>
      </html>
    `)}`
  );

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Security: Intercept external navigation and route to default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isLoopbackUrl(url)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isLoopbackUrl(url) && !url.startsWith("data:")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle("desktop:openExternal", async (_event, url: string) => {
    if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle("desktop:selectFolder", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select Project or Experience Evidence Folder",
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
}

function setupApplicationMenu(): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ] as Electron.MenuItemConstructorOptions[])
      : ([
          {
            label: "File",
            submenu: [{ role: "quit" }],
          },
        ] as Electron.MenuItemConstructorOptions[])),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [{ type: "separator" }, { role: "front" }]
          : [{ role: "close" }]),
      ] as Electron.MenuItemConstructorOptions[],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
