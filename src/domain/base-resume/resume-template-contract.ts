import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

import { resolveAppDataPaths } from "@/files/app-data";
import { applyMigrations, openDatabase } from "@/persistence/database";
import { WorkspaceError } from "@/domain/workspace/types";

export type ResumeTemplateSectionContract = {
  heading: string;
  tag: string;
  existingDetail: string;
};

export type ResumeTemplateContract = {
  baselineId: string;
  baselineDigest: string;
  sections: ResumeTemplateSectionContract[];
};

const digest = (bytes: Uint8Array) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const tag = (heading: string) =>
  heading
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function boundedMultiline(value: string, maximum: number) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(
      (line, index, lines) => line || (index > 0 && lines[index - 1] !== ""),
    )
    .join("\n")
    .slice(0, maximum)
    .trim();
}

function textFromTex(value: string, maximum = 900): string {
  return boundedMultiline(
    value
      .replace(/(^|[^\\])%.*/gm, "$1")
      .replace(/\\resumeskill\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "\n$1: $2")
      .replace(
        /\\resumeproject\s*\{([^{}]*)\}(?:\s*\{([^{}]*)\})?(?:\s*\{([^{}]*)\})?/g,
        (_, title, role) =>
          role?.trim() ? `\n${title} | ${role}\n` : `\n${title}\n`,
      )
      .replace(
        /\\resumeeducation\s*\{([^{}]*)\}\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
        "\n$1 | $2 | $3\n",
      )
      .replace(
        /\\resumeexperience\s*\{([^{}]*)\}\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
        "\n$1 | $2 | $3\n",
      )
      .replace(
        /\\(?:textbf|textit|emph|underline|href)\*?(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g,
        "$1",
      )
      .replace(/\\item\b(?:\s*\[[^\]]*\])?/g, "\n- ")
      .replace(
        /\\(?:hfill|vspace|smallskip|medskip|bigskip|noindent)\b(?:\s*\[[^\]]*\])?/g,
        " ",
      )
      .replace(/\\(?:begin|end)\s*\{[^{}]*\}/g, "\n")
      .replace(/\\[A-Za-z@]+\*?(?:\[[^\]]*\])?/g, " ")
      .replace(/[{}~]/g, " ")
      .replace(/\\./g, " ")
      .replace(/(?:https?:\/\/|www\.)\S+/gi, " "),
    maximum,
  );
}

/** Extract only top-level TeX sections; nested entry subsections are content. */
function topLevelSections(tex: string) {
  return [...tex.matchAll(/\\section\*?\s*\{((?:[^{}]|\{[^{}]*\}){1,320})\}/g)];
}

/**
 * Derives presentation-neutral labels and bounded readable detail from the
 * immutable imported TeX source. TeX bytes and private storage locations never
 * leave this server-only module.
 */
export function extractResumeTemplateContract(
  tex: string,
  baselineId: string,
  baselineDigest: string,
): ResumeTemplateContract | undefined {
  if (!tex || tex.length > 400_000) return undefined;
  const matches = topLevelSections(tex);
  const sections = matches.flatMap((match, index) => {
    const heading = textFromTex(match[1] ?? "")
      .replace(/\n/g, " ")
      .trim();
    const sectionTag = tag(heading);
    if (!heading || !sectionTag) return [];
    const body = tex.slice(
      (match.index ?? 0) + match[0].length,
      matches[index + 1]?.index ?? tex.length,
    );
    return [{ heading, tag: sectionTag, existingDetail: textFromTex(body) }];
  });
  if (
    sections.length < 2 ||
    sections.length > 8 ||
    new Set(sections.map((section) => section.tag)).size !== sections.length
  )
    return undefined;
  return { baselineId, baselineDigest, sections };
}

export async function readInitialResumeTemplateContract(
  input: { appDataRoot?: string } = {},
): Promise<ResumeTemplateContract> {
  const paths = await resolveAppDataPaths(input.appDataRoot);
  const db = openDatabase(paths.databasePath);
  let baseline:
    | {
        id: string;
        primaryFilename: string;
        primaryDigest: string;
        storageLocation: string;
      }
    | undefined;
  try {
    applyMigrations(db);
    // The first import is the unchanged initial baseline; later imports are history.
    baseline = db
      .prepare(
        "SELECT id, primary_filename AS primaryFilename, primary_digest AS primaryDigest, storage_location AS storageLocation FROM base_resumes ORDER BY imported_at ASC, id ASC LIMIT 1",
      )
      .get() as typeof baseline;
  } finally {
    db.close();
  }
  if (!baseline)
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "An imported resume.tex baseline is required before generating a draft.",
      "Restore or select your initial resume baseline, then try again.",
    );
  const expected = `base-resumes/${baseline.id}/${baseline.primaryFilename}`;
  const location = baseline.storageLocation.replaceAll("\\", "/");
  const file = resolve(paths.root, location);
  const root = resolve(paths.root);
  if (
    location !== expected ||
    basename(file) !== baseline.primaryFilename ||
    relative(root, file).startsWith("..")
  )
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The imported resume baseline is unavailable.",
      "Restore or select your initial resume baseline, then try again.",
    );
  let source: Uint8Array;
  try {
    const directory = join(paths.root, "base-resumes", baseline.id);
    const [directoryStat, fileStat] = await Promise.all([
      lstat(directory),
      lstat(file),
    ]);
    if (
      directoryStat.isSymbolicLink() ||
      fileStat.isSymbolicLink() ||
      !directoryStat.isDirectory() ||
      !fileStat.isFile()
    )
      throw new Error("unsafe baseline storage");
    source = await readFile(file);
    if (digest(source) !== baseline.primaryDigest)
      throw new Error("baseline digest mismatch");
  } catch {
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The imported resume baseline is unavailable.",
      "Restore or select your initial resume baseline, then try again.",
    );
  }
  const contract = extractResumeTemplateContract(
    Buffer.from(source).toString("utf8"),
    baseline.id,
    baseline.primaryDigest,
  );
  if (!contract)
    throw new WorkspaceError(
      "RESUME_COACH_INVALID",
      "The imported resume baseline has no usable section contract.",
      "Restore or select the initial resume.tex baseline, then try again.",
    );
  return contract;
}
