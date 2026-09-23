import { spawn, type ChildProcess } from "node:child_process";
import * as http from "node:http";
import * as net from "node:net";
import * as path from "node:path";
import * as fs from "node:fs";

export interface ServerManagerOptions {
  isDev?: boolean;
  port?: number;
  projectRoot?: string;
  serverPath?: string;
  pollIntervalMs?: number;
  readinessTimeoutMs?: number;
}

export function findAvailablePort(preferredPort = 3000, host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" || err.code === "EACCES") {
        // Preferred port is in use; probe an ephemeral port (port 0)
        const fallback = net.createServer();
        fallback.once("error", (fallbackErr) => reject(fallbackErr));
        fallback.listen(0, host, () => {
          const address = fallback.address();
          if (address && typeof address === "object") {
            const assignedPort = address.port;
            fallback.close(() => resolve(assignedPort));
          } else {
            fallback.close(() => reject(new Error("Unable to obtain assigned port.")));
          }
        });
      } else {
        reject(err);
      }
    });

    tester.listen(preferredPort, host, () => {
      const address = tester.address();
      if (address && typeof address === "object") {
        const assignedPort = address.port;
        tester.close(() => resolve(assignedPort));
      } else {
        tester.close(() => resolve(preferredPort));
      }
    });
  });
}

export function isServerReady(url: string, timeoutMs = 2000): Promise<boolean> {
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
          // Status in 200-399 range indicates healthy response
          const status = res.statusCode ?? 500;
          resolve(status >= 200 && status < 400);
          res.resume(); // Drain stream
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

export async function waitForServer(
  url: string,
  maxWaitMs = 30000,
  pollIntervalMs = 250
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const ready = await isServerReady(url, Math.min(pollIntervalMs, 1000));
    if (ready) return true;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

export class ServerManager {
  private childProcess: ChildProcess | null = null;
  private port: number = 3000;
  private baseUrl: string = "http://127.0.0.1:3000";
  private isDev: boolean;
  private projectRoot: string;
  private customServerPath?: string;
  private pollIntervalMs: number;
  private readinessTimeoutMs: number;

  constructor(options: ServerManagerOptions = {}) {
    this.isDev = options.isDev ?? (process.env.NODE_ENV === "development" || process.env.ELECTRON_DEV === "1");
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.customServerPath = options.serverPath;
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 30000;
    if (options.port) {
      this.port = options.port;
      this.baseUrl = `http://127.0.0.1:${this.port}`;
    }
  }

  public getPort(): number {
    return this.port;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getChildProcess(): ChildProcess | null {
    return this.childProcess;
  }

  public resolveServerPath(): string {
    if (this.customServerPath) {
      return this.customServerPath;
    }

    // In packaged app, check process.resourcesPath
    if (process.resourcesPath) {
      const resourcePath = path.join(process.resourcesPath, "standalone", "server.js");
      if (fs.existsSync(resourcePath)) {
        return resourcePath;
      }
    }

    // In packaged app, standalone server is copied to resources/standalone/server.js
    const packagedPath = path.join(this.projectRoot, "resources", "standalone", "server.js");
    if (fs.existsSync(packagedPath)) {
      return packagedPath;
    }

    // In unpacked project, standalone server is at .next/standalone/server.js
    const localStandalone = path.join(this.projectRoot, ".next", "standalone", "server.js");
    if (fs.existsSync(localStandalone)) {
      return localStandalone;
    }

    return localStandalone;
  }

  public async start(): Promise<string> {
    if (this.isDev) {
      // In dev mode, check if a dev server is already running on port 3000
      const devPort = this.port || 3000;
      const devUrl = `http://127.0.0.1:${devPort}`;
      const alreadyRunning = await isServerReady(devUrl, 1000);
      if (alreadyRunning) {
        this.port = devPort;
        this.baseUrl = devUrl;
        return this.baseUrl;
      }
    }

    // Find available port
    this.port = await findAvailablePort(this.port || 3000, "127.0.0.1");
    this.baseUrl = `http://127.0.0.1:${this.port}`;

    const serverPath = this.resolveServerPath();
    if (!fs.existsSync(serverPath)) {
      throw new Error(
        `Next.js standalone server not found at: ${serverPath}. Run 'npm run build' before launching the desktop application.`
      );
    }

    const serverCwd = path.dirname(serverPath);

    this.childProcess = spawn(process.execPath, [serverPath], {
      cwd: serverCwd,
      env: {
        ...process.env,
        PORT: String(this.port),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (this.childProcess.stderr) {
      this.childProcess.stderr.on("data", (data: Buffer) => {
        const message = data.toString();
        // Forward non-sensitive diagnostics
        if (process.env.DEBUG_DESKTOP) {
          console.error(`[NextServer:stderr] ${message}`);
        }
      });
    }

    const ready = await waitForServer(this.baseUrl, this.readinessTimeoutMs, this.pollIntervalMs);
    if (!ready) {
      await this.stop();
      throw new Error(
        `Next.js server failed to respond at ${this.baseUrl} within ${this.readinessTimeoutMs}ms.`
      );
    }

    return this.baseUrl;
  }

  public async stop(): Promise<void> {
    if (!this.childProcess) return;

    const child = this.childProcess;
    this.childProcess = null;

    if (child.exitCode !== null || child.killed) return;

    return new Promise((resolve) => {
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      child.once("exit", finish);

      // Send standard SIGTERM for graceful shutdown
      try {
        child.kill("SIGTERM");
      } catch {
        finish();
        return;
      }

      // Hard-kill fallback after 3 seconds if process did not exit
      setTimeout(() => {
        if (!resolved && child.exitCode === null && !child.killed) {
          try {
            child.kill("SIGKILL");
          } catch {
            // Ignore if already dead
          }
        }
        finish();
      }, 3000);
    });
  }
}
