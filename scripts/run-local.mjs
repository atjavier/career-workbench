import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const command = process.argv[2];
if (command !== "dev" && command !== "start") {
  throw new Error("Use this script with either 'dev' or 'start'.");
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, command, "--hostname", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});

child.on("exit", (code) => process.exit(code ?? 1));
