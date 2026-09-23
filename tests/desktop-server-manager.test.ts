import assert from "node:assert/strict";
import * as http from "node:http";
import * as net from "node:net";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  findAvailablePort,
  isServerReady,
  waitForServer,
  ServerManager,
} from "../electron/server-manager";

test("findAvailablePort returns a valid port and handles port collisions", async () => {
  // 1. Get an available port
  const port = await findAvailablePort(3800);
  assert.ok(port > 0 && port < 65536);

  // 2. Occupy this port with a temporary TCP server
  const blocker = net.createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.listen(port, "127.0.0.1", () => resolve());
    blocker.once("error", reject);
  });

  try {
    // 3. Asking for the same port should resolve to a different available ephemeral port
    const alternativePort = await findAvailablePort(port);
    assert.ok(alternativePort > 0 && alternativePort < 65536);
    assert.notEqual(alternativePort, port);
  } finally {
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  }
});

test("isServerReady accurately reflects HTTP endpoint health", async () => {
  // Test unreachable port
  const notReady = await isServerReady("http://127.0.0.1:49999", 200);
  assert.equal(notReady, false);

  // Create mock HTTP server returning 200
  let statusCode = 200;
  const mockServer = http.createServer((_req, res) => {
    res.writeHead(statusCode, { "Content-Type": "text/plain" });
    res.end("OK");
  });

  await new Promise<void>((resolve) => mockServer.listen(0, "127.0.0.1", () => resolve()));
  const address = mockServer.address() as net.AddressInfo;
  const mockUrl = `http://127.0.0.1:${address.port}/`;

  try {
    // Healthy 200
    const ready200 = await isServerReady(mockUrl, 1000);
    assert.equal(ready200, true);

    // Unhealthy 500
    statusCode = 500;
    const ready500 = await isServerReady(mockUrl, 1000);
    assert.equal(ready500, false);
  } finally {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  }
});

test("waitForServer times out cleanly when endpoint is unavailable", async () => {
  const result = await waitForServer("http://127.0.0.1:49998", 400, 100);
  assert.equal(result, false);
});

test("ServerManager resolves standalone paths and initializes configuration", async () => {
  const manager = new ServerManager({
    isDev: false,
    port: 3999,
    projectRoot: "/fake/root",
    serverPath: "/fake/root/.next/standalone/server.js",
  });

  assert.equal(manager.getPort(), 3999);
  assert.equal(manager.getBaseUrl(), "http://127.0.0.1:3999");
  assert.equal(manager.resolveServerPath(), "/fake/root/.next/standalone/server.js");
  assert.equal(manager.getChildProcess(), null);

  // stop() when not started should resolve safely without throwing
  await manager.stop();
});

test("Electron main configuration enforces single-instance lock and security boundaries", async () => {
  const mainSrc = await readFile(
    new URL("../electron/main.ts", import.meta.url),
    "utf8"
  );

  // Single-instance lock
  assert.match(mainSrc, /app\.requestSingleInstanceLock\(\)/);
  assert.match(mainSrc, /second-instance/);

  // WebPreferences security
  assert.match(mainSrc, /nodeIntegration:\s*false/);
  assert.match(mainSrc, /contextIsolation:\s*true/);
  assert.match(mainSrc, /sandbox:\s*true/);

  // External link routing
  assert.match(mainSrc, /setWindowOpenHandler/);
  assert.match(mainSrc, /shell\.openExternal/);
  assert.match(mainSrc, /isLoopbackUrl/);

  // Cross-platform window chrome & menu
  assert.match(mainSrc, /isMac/);
  assert.match(mainSrc, /titleBarStyle:\s*"default"/);
});

test("electron-builder configuration targets macOS, Windows, and Linux", async () => {
  const configRaw = await readFile(
    new URL("../electron-builder.json", import.meta.url),
    "utf8"
  );
  const config = JSON.parse(configRaw);

  // macOS
  assert.ok(config.mac);
  assert.ok(Array.isArray(config.mac.target));

  // Windows
  assert.ok(config.win);
  assert.ok(Array.isArray(config.win.target));
  assert.ok(config.nsis);

  // Linux
  assert.ok(config.linux);
  assert.ok(Array.isArray(config.linux.target));
});

