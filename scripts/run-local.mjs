import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const command = process.argv[2];
if (command !== "dev" && command !== "start") {
  throw new Error("Use this script with either 'dev' or 'start'.");
}

const require = createRequire(import.meta.url);
const standalone = resolve(".next/standalone/server.js");
if (command === "start" && !existsSync(standalone)) {
  throw new Error("Production build is missing. Run 'npm run build' before 'npm start'.");
}
const args = command === "start"
  ? [standalone]
  : [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1"];
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  // Generated standalone/server.js changes cwd to its runtime asset directory.
  // Keep writable evidence in the same workspace used by local development.
  env: { ...process.env, CAREER_WORKBENCH_WORKSPACE_ROOT: resolve(process.env.CAREER_WORKBENCH_WORKSPACE_ROOT ?? process.cwd()), HOSTNAME: "127.0.0.1", NEXT_TELEMETRY_DISABLED: "1" },
});

function forwardSignal(signal) {
  if (!child.killed) {
    try {
      child.kill(signal);
    } catch {
      // Ignore if already terminated
    }
  }
}

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGHUP", () => forwardSignal("SIGHUP"));

child.on("error", (error) => { console.error(error.message); process.exit(1); });
child.on("exit", (code, signal) => process.exit(code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1)));
