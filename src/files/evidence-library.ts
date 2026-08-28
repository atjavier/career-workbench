import { createHash } from "node:crypto";
import { lstat, mkdir, open, readdir, rm, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { WorkspaceError } from "@/domain/workspace/types";
import { getResumeAgentSkill } from "@/domain/resume-agent/skill-registry";

export type LibraryCategory = "project" | "experience";
export type MarkdownDocument = { absolutePath: string; libraryPath: string; bytes: Uint8Array; text: string; contentDigest: string; category: LibraryCategory };
export type CopiedLibraryContent = { documents: MarkdownDocument[]; sourceDigest: string; cleanup: () => Promise<void> };
export type DocumentedArtifactSet = CopiedLibraryContent & { name: string; category: LibraryCategory };
export type ResumeDocumentationSource = { files: Array<{ path: string; text: string; contentDigest: string }>; sourceDigest: string };
type UploadedSourceManifest = { root: string; files: Array<{ path: string; name: string; size: number }> };
const digest = (value: string | Uint8Array) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const decoder = new TextDecoder("utf-8", { fatal: true });
const maxDocumentBytes = 2 * 1024 * 1024;
const maxDocumentsPerImport = 200;
const reservedWindowsNames = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
function documentationSnapshotPriority(path: string): number {
  const normalized = path.toLowerCase();
  if (/^(?:package\.json|pyproject\.toml|cargo\.toml|composer\.json|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|requirements(?:\.txt)?|docker-compose(?:\.ya?ml)?|dockerfile)$/.test(normalized)) return 0;
  if (/^(?:readme|overview|architecture|design|requirements?|documentation)\.(?:md|txt)$/.test(normalized)) return 1;
  if (/(?:^|\/)(?:main|index|app|server|application)\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|cs|rb|php)$/.test(normalized)) return 2;
  if (/(?:^|\/)(?:routes?|controllers?|handlers?|api|services?|models?|schemas?|database|db)(?:\/|\.)/.test(normalized)) return 3;
  if (/(?:^|\/)(?:components?|pages?|views?|client|frontend|ui)(?:\/|\.)/.test(normalized)) return 4;
  if (/(?:^|\/)(?:docs?|documentation|\.github\/workflows)(?:\/|\.)/.test(normalized)) return 5;
  if (/(?:^|\/)(?:tests?|__tests__|spec)(?:\/|\.)/.test(normalized)) return 6;
  if (/(?:^|\/)(?:eslint|vite|webpack|babel|tsconfig|prettier)\b/.test(normalized)) return 9;
  return 7;
}
function documentationTraversalPriority(name: string): number {
  const normalized = name.toLowerCase();
  if (/^(?:client|frontend|web|server|backend|api|app|src)$/.test(normalized)) return 0;
  if (/^(?:routes?|controllers?|handlers?|services?|models?|schemas?|entities|database|db|components?|pages?|views?|ui)$/.test(normalized)) return 1;
  if (/^(?:docs?|documentation|scripts?|infra|\.github|tests?|__tests__)$/.test(normalized)) return 2;
  if (/^(?:package\.json|pyproject\.toml|cargo\.toml|composer\.json|go\.mod|readme\.(?:md|txt)|dockerfile|docker-compose(?:\.ya?ml)?)$/.test(normalized)) return 0;
  return 5;
}
export function evidenceLibraryRoot(workspaceRoot?: string): string { return resolve(workspaceRoot ?? process.cwd(), "resume-evidence"); }
function safeSegment(value: string): string { const result = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.\s-]+|[.\s-]+$/g, ""); if (!result || result === "." || result === ".." || reservedWindowsNames.has(result.toUpperCase())) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The library name needs a safe, non-empty value.", "Use a short name containing letters, numbers, spaces, dots, underscores, or hyphens."); return result; }
function inside(root: string, target: string): boolean { const value = relative(root, target); return value !== "" && value !== ".." && !value.startsWith(`..${sep}`) && !value.includes(`${sep}..${sep}`); }
async function requireDirectory(path: string, nextAction: string): Promise<void> { try { const info = await lstat(path); if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("unsafe"); } catch { throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected project folder is unavailable or unsafe.", nextAction); } }
async function assertSafeAncestors(path: string): Promise<void> { for (let current = resolve(path); ; current = resolve(current, "..")) { const info = await lstat(current).catch(() => undefined); if (info && (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()))) throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "The selected folder contains an unsafe link or entry.", "Choose a working folder without links and try again."); const parent = resolve(current, ".."); if (parent === current) return; } }
async function bytesAndText(path: string, size: number, expected?: Pick<Stats, "dev" | "ino">): Promise<{ bytes: Uint8Array; text: string }> { if (!size || size > maxDocumentBytes) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A selected Markdown document is empty or too large.", "Choose Markdown files up to 2 MB and try again."); let handle; try { handle = await open(path, "r"); const opened = await handle.stat(); if (!opened.isFile() || (expected && (opened.dev !== expected.dev || opened.ino !== expected.ino))) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A selected Markdown document changed while it was being checked.", "Choose the project folder again and try the import."); const bytes = await handle.readFile(); if (bytes.byteLength !== size) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A selected Markdown document changed while it was being read.", "Choose the project folder again and try the import."); try { return { bytes, text: decoder.decode(bytes) }; } catch { throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A selected Markdown document is not valid UTF-8 text.", "Save the document as UTF-8 Markdown and try again."); } } catch (error) { if (error instanceof WorkspaceError) throw error; throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A selected Markdown document is unavailable or unsafe.", "Choose a readable Markdown document and try again."); } finally { await handle?.close(); } }
export async function enumerateMarkdown(root: string, category: LibraryCategory, allowEmpty = false): Promise<MarkdownDocument[]> {
  await requireDirectory(root, "Choose an accessible project folder without links and try again."); const rootPath = resolve(root); const found: MarkdownDocument[] = [];
  async function visit(current: string): Promise<void> { for (const entry of await readdir(current, { withFileTypes: true })) { const child = join(current, entry.name); const metadata = await lstat(child); if (metadata.isSymbolicLink()) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected folder contains a link or reparse point.", "Choose a folder without links and try again."); if (metadata.isDirectory()) await visit(child); else if (metadata.isFile() && child.toLowerCase().endsWith(".md")) { if (found.length >= maxDocumentsPerImport) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected folder has too many Markdown documents.", "Split the folder into smaller project imports and try again."); const captured = await bytesAndText(child, metadata.size, metadata); found.push({ absolutePath: child, libraryPath: relative(rootPath, child).replaceAll("\\", "/"), ...captured, contentDigest: digest(captured.bytes), category }); } } }
  await visit(rootPath); if (!found.length && !allowEmpty) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "No readable Markdown documents were found in the selected folder.", "Choose a folder containing Markdown resume evidence and try again."); return found;
}
async function cleanManaged(path: string, root: string): Promise<void> { if (inside(root, path)) await rm(path, { recursive: true, force: true }); }
export async function copyProjectMarkdown(sourceDirectory: string, projectName?: string, workspaceRoot?: string): Promise<CopiedLibraryContent & { projectName: string }> {
  const source = resolve(sourceDirectory); const projectNameSafe = safeSegment(projectName || basename(source)); const root = evidenceLibraryRoot(workspaceRoot); const destination = join(root, "projects", projectNameSafe); if (source === root || inside(root, source)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A managed library folder cannot be added as a project source.", "Choose the original project folder outside resume-evidence and try again."); if (!inside(root, destination)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The project import location is unsafe.", "Choose a different project name and try again."); const sourceDocuments = await enumerateMarkdown(source, "project");
  try { await mkdir(join(root, "projects"), { recursive: true }); await mkdir(destination); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new WorkspaceError("EVIDENCE_LIBRARY_DUPLICATE", "That project has already been added to the evidence library.", "Refresh the library or choose a different project name."); throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The project could not be copied into the evidence library.", "Check local folder access and try again."); }
  try { const documents: MarkdownDocument[] = []; for (const item of sourceDocuments) { const target = join(destination, item.libraryPath); if (!inside(destination, target)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A selected document path is unsafe.", "Choose a folder without unsafe paths and try again."); await mkdir(resolve(target, ".."), { recursive: true }); await writeFile(target, item.bytes, { flag: "wx" }); documents.push({ ...item, absolutePath: target, libraryPath: relative(resolve(/* turbopackIgnore: true */ workspaceRoot ?? process.cwd()), target).replaceAll("\\", "/") }); }
    return { projectName: projectNameSafe, documents, sourceDigest: digest(sourceDocuments.map((item) => `${item.libraryPath}:${item.contentDigest}`).sort().join("\n")), cleanup: () => cleanManaged(destination, root) };
  } catch (error) { await cleanManaged(destination, root); throw error; }
}
export async function copyExperienceMarkdown(input: { name: string; markdown?: string; sourceFile?: string; workspaceRoot?: string }): Promise<CopiedLibraryContent> {
  const name = safeSegment(input.name); const root = evidenceLibraryRoot(input.workspaceRoot); const destination = join(root, "experiences", `${name}.md`); if (!inside(root, destination)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The experience import location is unsafe.", "Choose a different experience name and try again.");
  let captured: { bytes: Uint8Array; text: string }; if (input.sourceFile) { const source = resolve(input.sourceFile); const metadata = await lstat(source).catch(() => undefined); if (!metadata || !metadata.isFile() || metadata.isSymbolicLink() || !source.toLowerCase().endsWith(".md")) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The selected experience document is unavailable or unsupported.", "Choose one readable Markdown file up to 2 MB and try again."); captured = await bytesAndText(source, metadata.size, metadata); } else { const text = input.markdown ?? ""; if (!text.trim()) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "Experience content is required.", "Enter Markdown content or choose a Markdown file and try again."); const bytes = new TextEncoder().encode(text); if (bytes.byteLength > maxDocumentBytes) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "Experience Markdown is too large.", "Enter Markdown content up to 2 MB and try again."); captured = { bytes, text }; }
  try { await mkdir(join(root, "experiences"), { recursive: true }); await writeFile(destination, captured.bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new WorkspaceError("EVIDENCE_LIBRARY_DUPLICATE", "That experience has already been added to the evidence library.", "Refresh the library or choose a different experience name."); throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The experience could not be copied into the evidence library.", "Check local folder access and try again."); }
  const document = { absolutePath: destination, libraryPath: relative(resolve(/* turbopackIgnore: true */ input.workspaceRoot ?? process.cwd()), destination).replaceAll("\\", "/"), ...captured, contentDigest: digest(captured.bytes), category: "experience" as const };
  return { documents: [document], sourceDigest: digest(captured.bytes), cleanup: () => cleanManaged(destination, root) };
}
const requiredDocumentationArtifacts = {
  project: ["project-overview.md", "resume-evidence.md", "resume-bullet-candidates.md"],
  experience: ["experience-overview.md", "resume-evidence.md", "resume-bullet-candidates.md"],
} as const satisfies Record<LibraryCategory, readonly string[]>;
const supportingDocumentationArtifacts = ["index.md", "resume-summary.md", "architecture.md", "source-tree-analysis.md", "technology-stack.md", "api-contracts.md", "data-models.md", "component-inventory.md", "development-guide.md", "deployment-guide.md", "integration-architecture.md", "project-parts.md", "contribution-guide.md", "experience-context.md", "work-deliverables.md", "collaboration-and-process.md"] as const;
function requiredArtifactsFor(category: LibraryCategory): readonly string[] { return requiredDocumentationArtifacts[category]; }
function allowedArtifactsFor(category: LibraryCategory): Set<string> { return new Set([...requiredArtifactsFor(category), ...supportingDocumentationArtifacts, ...(category === "experience" ? ["project-overview.md"] : [])]); }
function hasRequiredArtifacts(category: LibraryCategory, names: readonly string[]): boolean { const overviewPresent = category === "experience" ? names.includes("experience-overview.md") || names.includes("project-overview.md") : names.includes("project-overview.md"); return overviewPresent && requiredArtifactsFor(category).filter((name) => !name.endsWith("-overview.md")).every((name) => names.includes(name)); }
const generatedFileName = (name: string) => /(?:^|[._-])(?:generated|autogen|auto-generated)(?:[._-]|$)|\.min\.(?:js|css)$/i.test(name);
async function readDocumentationArtifacts(directory: string, category: LibraryCategory, libraryPrefix: string): Promise<MarkdownDocument[]> {
  await requireDirectory(directory, "Choose an accessible generated-document folder without links and try again.");
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The generated-document folder is unavailable or unsafe.", "Choose the completed documentation output folder and try again."); }
  const names = entries.map((entry) => entry.name).sort();
  const allowed = allowedArtifactsFor(category);
  if (!hasRequiredArtifacts(category, names) || names.some((name) => !allowed.has(name))) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", `The generated ${category} documentation folder is missing a required review document or contains an unsupported file.`, `Choose the output folder containing the ${category} review documents and supported documentation set.`);
  const documents: MarkdownDocument[] = [];
  for (const name of names) {
    const path = join(directory, name); const metadata = await lstat(path).catch(() => undefined);
    if (!metadata?.isFile() || metadata.isSymbolicLink()) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A generated review document is unavailable or unsafe.", "Run the documentation skill again into a new empty output folder.");
    const captured = await bytesAndText(path, metadata.size, metadata);
    documents.push({ absolutePath: path, libraryPath: `${libraryPrefix}/${name}`, ...captured, contentDigest: digest(captured.bytes), category });
  }
  return documents;
}
export async function copyDocumentedEvidenceArtifacts(input: { outputDirectory: string; name: string; category: LibraryCategory; workspaceRoot?: string }): Promise<DocumentedArtifactSet> {
  const name = safeSegment(input.name); const source = resolve(input.outputDirectory); const root = evidenceLibraryRoot(input.workspaceRoot); const categoryRoot = input.category === "project" ? "projects" : "experiences"; const destination = join(root, categoryRoot, name);
  if (source === root || inside(root, source)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "Generated documents must be outside the managed evidence library.", "Choose the separate output folder created by the documentation skill.");
  if (!inside(root, destination)) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The managed import location is unsafe.", "Choose a different item name and try again.");
  const sourceDocuments = await readDocumentationArtifacts(source, input.category, `resume-evidence/${categoryRoot}/${name}`);
  try { await mkdir(join(root, categoryRoot), { recursive: true }); await mkdir(destination); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new WorkspaceError("EVIDENCE_LIBRARY_DUPLICATE", "That documented item has already been imported.", "Choose a different item name or review the existing collection item."); throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "The generated documents could not be copied into the managed library.", "Check local folder access and try again."); }
  try {
    const documents: MarkdownDocument[] = [];
    for (const item of sourceDocuments) { const target = join(destination, item.libraryPath.split("/").at(-1)!); await writeFile(target, item.bytes, { flag: "wx" }); documents.push({ ...item, absolutePath: target }); }
    return { name, category: input.category, documents, sourceDigest: digest(sourceDocuments.map((item) => `${item.libraryPath}:${item.contentDigest}`).join("\n")), cleanup: () => cleanManaged(destination, root) };
  } catch (error) { await cleanManaged(destination, root); throw error; }
}
export async function readManagedDocumentedArtifacts(workspaceRoot?: string): Promise<Array<{ name: string; category: LibraryCategory; documents: MarkdownDocument[] }>> {
  const root = evidenceLibraryRoot(workspaceRoot); const groups: Array<{ name: string; category: LibraryCategory; documents: MarkdownDocument[] }> = [];
  for (const [category, directoryName] of [["project", "projects"], ["experience", "experiences"]] as const) {
    const categoryDirectory = join(root, directoryName); const categoryInfo = await lstat(categoryDirectory).catch(() => undefined);
    if (!categoryInfo) continue;
    if (!categoryInfo.isDirectory() || categoryInfo.isSymbolicLink()) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A managed collection folder is unavailable or unsafe.", "Check the managed review documents and refresh the page.");
    for (const entry of await readdir(categoryDirectory, { withFileTypes: true })) {
      const itemDirectory = join(categoryDirectory, entry.name); const itemInfo = await lstat(itemDirectory);
      if (itemInfo.isSymbolicLink()) throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A managed collection item is unsafe.", "Check the managed review documents and refresh the page.");
      if (!itemInfo.isDirectory()) continue; // Historical Markdown imports are intentionally outside the active collection.
      const names = (await readdir(itemDirectory)).sort(); const hasArtifactName = hasRequiredArtifacts(category, names);
      if (!hasArtifactName) continue; // Historical Markdown imports are intentionally outside the active collection.
      groups.push({ name: entry.name, category, documents: await readDocumentationArtifacts(itemDirectory, category, `resume-evidence/${directoryName}/${entry.name}`) });
    }
  }
  return groups.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
export async function readResumeDocumentationSource(sourceDirectory: string, workspaceRoot?: string): Promise<{ files: Array<{ path: string; text: string; contentDigest: string }>; sourceDigest: string }> {
  const source = resolve(sourceDirectory); const root = evidenceLibraryRoot(workspaceRoot); if (source === root || inside(root, source)) throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "The selected source folder is not available for documentation.", "Choose the original working folder outside resume-evidence."); await requireDirectory(source, "Choose an accessible working folder without links and try again.");
  const skill = getResumeAgentSkill("resume.document-source-folder"); const extensions = new Set(skill.allowedExtensions); const excludedDirectories = new Set(skill.excludedDirectories); const candidates: Array<{ absolutePath: string; path: string; size: number; metadata: Pick<Stats, "dev" | "ino"> }> = []; let directories = 0; let entriesSeen = 0;
  const pending: Array<{ path: string; depth: number }> = [{ path: source, depth: 0 }];
  while (pending.length && directories < skill.limits.maxDirectories && entriesSeen < skill.limits.maxEntries) {
    const current = pending.shift()!; if (current.depth > skill.limits.maxDepth) continue;
    directories += 1; await assertSafeAncestors(current.path);
    const entries = (await readdir(current.path, { withFileTypes: true })).sort((left, right) => documentationTraversalPriority(left.name) - documentationTraversalPriority(right.name) || left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entriesSeen >= skill.limits.maxEntries) break;
      entriesSeen += 1;
      if (entry.isDirectory() && excludedDirectories.has(entry.name.toLowerCase())) continue;
      const path = join(current.path, entry.name); const info = await lstat(path);
      if (info.isSymbolicLink()) throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "The selected source folder contains a link or reparse point.", "Choose a working folder without links and try again.");
      if (info.isDirectory()) { pending.push({ path, depth: current.depth + 1 }); continue; }
      if (!info.isFile() || generatedFileName(entry.name) || !extensions.has(extname(entry.name).toLowerCase()) || info.size === 0 || info.size > skill.limits.maxFileBytes) continue;
      candidates.push({ absolutePath: path, path: relative(source, path).replaceAll("\\", "/"), size: info.size, metadata: info });
    }
  }
  const files: Array<{ path: string; text: string; contentDigest: string }> = [];
  for (const candidate of candidates.sort((left, right) => documentationSnapshotPriority(left.path) - documentationSnapshotPriority(right.path) || left.path.localeCompare(right.path))) {
    if (files.length >= skill.limits.maxFiles) break;
    const captured = await bytesAndText(candidate.absolutePath, candidate.size, candidate.metadata); const file = { path: candidate.path, text: captured.text, contentDigest: digest(captured.bytes) };
    if (JSON.stringify([...files, file]).length <= skill.limits.maxSnapshotChars) files.push(file);
  }
  if (!files.length) throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", "No safe text material was found in the selected source folder.", "Choose a working folder containing readable documentation or source files."); files.sort((a, b) => a.path.localeCompare(b.path)); return { files, sourceDigest: digest(files.map((file) => `${file.path}:${file.contentDigest}`).join("\n")) };
}
function invalidSnapshot(message: string, nextAction = "Choose the folder again and try documentation."): never { throw new WorkspaceError("EVIDENCE_DOCUMENTER_INVALID", message, nextAction); }
function snapshotPath(value: string): string {
  if (!value || value.length > 600 || value.includes("\\") || /[\u0000-\u001f]/.test(value) || value.startsWith("/") || /^[a-z]:/i.test(value)) invalidSnapshot("The selected folder snapshot has an unsafe relative path.");
  const parts = value.split("/"); if (parts.some((part) => !part || part === "." || part === "..")) invalidSnapshot("The selected folder snapshot has an unsafe relative path.");
  return value;
}
/** Converts a browser-selected, untrusted file list into the registered skill's bounded source snapshot. */
export async function readUploadedResumeDocumentationSource(input: { files: File[]; manifest: string }): Promise<ResumeDocumentationSource> {
  if (input.manifest.length > 64_000) invalidSnapshot("The selected folder details exceed the safe inspection boundary.", "Choose a smaller folder and try documentation.");
  let manifest: unknown; try { manifest = JSON.parse(input.manifest); } catch { invalidSnapshot("The selected folder details are unavailable."); }
  if (!manifest || typeof manifest !== "object" || !Array.isArray((manifest as UploadedSourceManifest).files) || !(manifest as UploadedSourceManifest).files.length || (manifest as UploadedSourceManifest).files.length !== input.files.length || typeof (manifest as UploadedSourceManifest).root !== "string") invalidSnapshot("The selected folder details do not match its files.");
  const skill = getResumeAgentSkill("resume.document-source-folder"); const extensions = new Set(skill.allowedExtensions); const excluded = new Set(skill.excludedDirectories); const paths = new Set<string>(); const directories = new Set<string>(); const files: ResumeDocumentationSource["files"] = [];
  const root = snapshotPath((manifest as UploadedSourceManifest).root); if (root.includes("/")) invalidSnapshot("The selected folder details do not match its files.");
  if (input.files.length > skill.limits.maxFiles) invalidSnapshot("The selected folder has too many eligible files.", "Choose a smaller folder and try documentation.");
  for (const [index, file] of input.files.entries()) {
    const item = (manifest as UploadedSourceManifest).files[index];
    if (!item || typeof item.path !== "string" || typeof item.name !== "string" || !Number.isSafeInteger(item.size) || item.name !== file.name || item.size !== file.size) invalidSnapshot("The selected folder details do not match its files.");
    const submittedPath = snapshotPath(item.path); const submittedParts = submittedPath.split("/"); if (submittedParts[0] !== root || submittedParts.length < 2) invalidSnapshot("The selected folder details do not describe one folder."); const path = submittedParts.slice(1).join("/"); const parts = path.split("/");
    if (parts.at(-1) !== file.name || paths.has(path) || parts.length - 1 > skill.limits.maxDepth || parts.slice(0, -1).some((part) => excluded.has(part.toLowerCase())) || generatedFileName(file.name) || !extensions.has(extname(file.name).toLowerCase()) || !file.size || file.size > skill.limits.maxFileBytes) invalidSnapshot("The selected folder contains unsupported or unsafe files.", "Choose a smaller folder with supported source files and try documentation.");
    paths.add(path); for (let depth = 1; depth < parts.length; depth += 1) directories.add(parts.slice(0, depth).join("/"));
    if (directories.size > skill.limits.maxDirectories || input.files.length + directories.size > skill.limits.maxEntries) invalidSnapshot("The selected folder exceeds the safe inspection boundary.", "Choose a smaller folder and try documentation.");
    const bytes = new Uint8Array(await file.arrayBuffer()); if (bytes.byteLength !== file.size || bytes.includes(0)) invalidSnapshot("A selected source file is unsafe or changed while it was being read.");
    let text: string; try { text = decoder.decode(bytes); } catch { invalidSnapshot("A selected source file is not valid UTF-8 text.", "Choose a folder containing readable source files and try documentation."); }
    const candidate = { path, text, contentDigest: digest(bytes) }; if (JSON.stringify([...files, candidate]).length > skill.limits.maxSnapshotChars) invalidSnapshot("The selected folder exceeds the safe inspection boundary.", "Choose a smaller folder and try documentation.");
    files.push(candidate);
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return { files, sourceDigest: digest(files.map((file) => `${file.path}:${file.contentDigest}`).join("\n")) };
}
export async function readManagedMarkdown(workspaceRoot?: string): Promise<MarkdownDocument[]> {
  const root = evidenceLibraryRoot(workspaceRoot); try { await requireDirectory(root, "Add a project or experience before refreshing the library."); } catch { throw new WorkspaceError("EVIDENCE_LIBRARY_EMPTY", "The Resume Evidence Library is empty.", "Add a project or experience, then refresh the library."); }
  const result: MarkdownDocument[] = []; for (const [category, name] of [["project", "projects"], ["experience", "experiences"]] as const) { const categoryRoot = join(root, name); try { await lstat(categoryRoot); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw new WorkspaceError("EVIDENCE_LIBRARY_INVALID", "A managed library folder is unavailable.", "Check the Resume Evidence Library folder and refresh again."); } const documents = await enumerateMarkdown(categoryRoot, category, true); const documentedParents = new Set<string>(); for (const document of documents) { const parent = resolve(document.absolutePath, ".."); if (document.libraryPath.split("/").length === 2) { const names = (await readdir(parent)).sort(); if (hasRequiredArtifacts(category, names) && names.every((entry) => allowedArtifactsFor(category).has(entry))) documentedParents.add(parent); } } result.push(...documents.filter((document) => !documentedParents.has(resolve(document.absolutePath, "..")))); }
  if (!result.length) throw new WorkspaceError("EVIDENCE_LIBRARY_EMPTY", "The Resume Evidence Library has no Markdown documents.", "Add a project or experience, then refresh the library."); return result.map((item) => ({ ...item, libraryPath: `resume-evidence/${item.category === "project" ? "projects" : "experiences"}/${item.libraryPath}` }));
}
