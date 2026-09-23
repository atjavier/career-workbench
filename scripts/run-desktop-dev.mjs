import { spawn } from "node:child_process";
import * as http from "node:http";
import * as path from "node:path";

function isReady(url, timeoutMs = 1000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname,
          method: "GET",
          timeout: timeoutMs,
        },
        (res) => {
          resolve((res.statusCode ?? 500) < 500);
          res.resume();
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

async function waitForUrl(url, maxWaitMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isReady(url)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// 1. Compile Electron TypeScript
console.log("Compiling Electron scripts...");
const tscProcess = spawn("npx", ["tsc", "-p", "electron/tsconfig.json"], {
  stdio: "inherit",
});

await new Promise((resolve, reject) => {
  tscProcess.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`tsc failed with exit code ${code}`));
  });
});

// 2. Start Next.js dev server if not already running
const devUrl = "http://127.0.0.1:3000";
let nextChild = null;

if (!(await isReady(devUrl))) {
  console.log("Starting Next.js development server...");
  nextChild = spawn(process.execPath, ["scripts/run-local.mjs", "dev"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ELECTRON_DEV: "1" },
  });

  const ready = await waitForUrl(devUrl);
  if (!ready) {
    if (nextChild) nextChild.kill("SIGKILL");
    throw new Error("Next.js dev server did not start in time.");
  }
}

// 3. Launch Electron pointing to dev server
console.log("Launching Career Workbench desktop application...");
const electronChild = spawn("npx", ["electron", "dist-electron/main.js"], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_DEV: "1", NODE_ENV: "development" },
});

function cleanup() {
  if (nextChild && !nextChild.killed) {
    try {
      nextChild.kill("SIGTERM");
      setTimeout(() => {
        try {
          if (!nextChild.killed) nextChild.kill("SIGKILL");
        } catch {
          // Ignore
        }
      }, 1000).unref();
    } catch {
      // Ignore
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

electronChild.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
