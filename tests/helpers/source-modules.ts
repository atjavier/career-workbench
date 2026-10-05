import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function readActionSources(): Promise<string> {
  const root = "src/app/actions";
  return (await Promise.all((await readdir(root)).filter(name => name.endsWith(".ts")).sort().map(name => readFile(join(root, name), "utf8")))).join("\n");
}
export async function readGatewaySources(): Promise<string> {
  const root = "src/adapters/local-model";
  return (await Promise.all((await readdir(root)).filter(name => name.endsWith(".ts")).sort().map(name => readFile(join(root, name), "utf8")))).join("\n");
}
