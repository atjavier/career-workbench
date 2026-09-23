import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});

child.on("exit", (code) => {
  if (code === 0) {
    try {
      const srcStatic = path.resolve(".next/static");
      const destStatic = path.resolve(".next/standalone/.next/static");
      if (fs.existsSync(srcStatic)) {
        fs.cpSync(srcStatic, destStatic, { recursive: true, force: true });
      }
      const srcPublic = path.resolve("public");
      const destPublic = path.resolve(".next/standalone/public");
      if (fs.existsSync(srcPublic)) {
        fs.cpSync(srcPublic, destPublic, { recursive: true, force: true });
      }
    } catch (err) {
      console.error("Failed to copy static assets to standalone directory:", err);
      process.exit(1);
    }
  }
  process.exit(code ?? 1);
});
