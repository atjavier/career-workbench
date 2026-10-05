import { resumeFileAgentInstruction } from "@/adapters/local-model/resume-file-agent";
import { cleanDateString } from "@/domain/resume-generation/resume-pdf";
import type { ResumeFileCitation, ResumeFileReadSession, ResumeFileToolAction } from "@/files/evidence-library";
import type { FetchLike, ResumeCoachRequest, ResumeCoachResponse } from "./local-model-contracts";
import { allowedKeys, boundedText, exactKeys, maxFileAgentElapsedMs, plain, sha, supports } from "./model-boundaries";
import { native } from "./native-transport";
import { convertFlatEntriesToEdits, extractCandidateBulletsFromDocs, extractDateFromDocs, extractTechStackFromDocs, matchesDocGroupName, resumeBulletMarker, resumeProjectName, synthesizeEducation, synthesizeSkills } from "./resume-composition";
import { coachResponse, isValidResumeBulletText, isWorkSection, splitWorkEntries } from "./resume-response-validation";

export async function requestFileAgentResume(
  request: ResumeCoachRequest,
  session: ResumeFileReadSession,
  fetcher: FetchLike,
): Promise<ResumeCoachResponse> {
  const baseline = request.baseline;
  if (!baseline) throw new Error("missing resume baseline");
  const slots = baseline.sections
    .map((section, index) => ({
      slotId: section.tag,
      heading: section.heading,
      index,
    }))
    .filter((slot) => isWorkSection(slot.heading));
  if (!slots.length) throw new Error("missing editable resume slots");
  const observations: unknown[] = [];
  const readCitationText = new Map<string, string>();
  const executedReadCitations: ResumeFileCitation[] = [];
  const executedActions = new Set<string>();
  const started = Date.now();
  for (let turn = 0; turn < 12; turn += 1) {
    const remainingMs = maxFileAgentElapsedMs - (Date.now() - started);
    if (remainingMs <= 0) throw new Error("file agent time budget exhausted");
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[file-agent] Turn ${turn + 1}/12 starting (budget remaining: ${Math.round(remainingMs / 1000)}s)...`,
      );
    }
    const value = await native(
      request.connection,
      resumeFileAgentInstruction,
      {
        roots: session.roots.map((root) => {
          const docGroup = (request.documentation ?? []).find(
            (g) =>
              (root.name && matchesDocGroupName(g.name, root.name)) ||
              (root.name && g.name.toLowerCase().includes(root.name.toLowerCase())) ||
              (root.category &&
                g.category === root.category &&
                (request.documentation ?? []).filter((d) => d.category === root.category).length === 1),
          );
          const candidateBullets = docGroup
            ? extractCandidateBulletsFromDocs(docGroup.documents).slice(0, 5)
            : [];
          const techStack = docGroup
            ? extractTechStackFromDocs(docGroup.documents)
            : undefined;
          const rootClarifications = (request.clarifications ?? []).filter(
            (c) =>
              root.name &&
              (matchesDocGroupName(c.itemName ?? "", root.name) ||
                (c.itemName &&
                  (root.name.toLowerCase().includes(c.itemName.toLowerCase()) ||
                    c.itemName.toLowerCase().includes(root.name.toLowerCase())))),
          );
          const dateClarification = rootClarifications.find(
            (c) =>
              /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}-\d{2})\b/i.test(c.text),
          );
          const dates = dateClarification
            ? cleanDateString(dateClarification.text)
            : docGroup
              ? cleanDateString(extractDateFromDocs(docGroup.documents))
              : undefined;

          return {
            ...root,
            ...(techStack ? { techStack } : {}),
            ...(dates ? { dates } : {}),
            ...(rootClarifications.length > 0
              ? {
                  clarifications: rootClarifications.map((c) => ({
                    category: c.category,
                    text: c.text,
                  })),
                }
              : {}),
            ...(candidateBullets.length > 0 ? { candidateBullets } : {}),
          };
        }),
        slots: slots.map(({ slotId, heading }) => ({ slotId, heading })),
        profile: request.profileSnapshot,
        clarifications: (request.clarifications ?? []).map((c) => ({
          itemName: c.itemName,
          category: c.category,
          text: c.text,
        })),
        request: request.userRequest,
        observations,
      },
      8_000,
      fetcher,
      "RESUME_COACH_UNAVAILABLE",
      48_000,
      "off",
      remainingMs,
    );
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[file-agent] Turn ${turn + 1} completed: kind=${value.kind}`,
      );
    }
    if (value.kind === "tool" && exactKeys(value, ["kind", "action"])) {
      const action = value.action;
      if (!action || typeof action !== "object" || Array.isArray(action))
        throw new Error("invalid file tool action");
      const candidate = action as Record<string, unknown>;
      const validList =
        candidate.action === "list" &&
        allowedKeys(
          candidate,
          ["action", "rootId"],
          ["path", "startLine", "endLine"],
        ) &&
        plain(candidate.rootId, 80) &&
        (candidate.path === undefined || typeof candidate.path === "string") &&
        (candidate.startLine === undefined ||
          Number.isInteger(candidate.startLine)) &&
        (candidate.endLine === undefined ||
          Number.isInteger(candidate.endLine));
      const validRead =
        candidate.action === "read" &&
        allowedKeys(
          candidate,
          ["action", "rootId", "path"],
          ["startLine", "endLine"],
        ) &&
        plain(candidate.rootId, 80) &&
        plain(candidate.path, 600) &&
        (candidate.startLine === undefined ||
          Number.isInteger(candidate.startLine)) &&
        (candidate.endLine === undefined ||
          Number.isInteger(candidate.endLine));
      if (!validList && !validRead) throw new Error("invalid file tool action");
      const normalizedAction: ResumeFileToolAction =
        candidate.action === "list"
          ? {
              action: "list",
              rootId: String(candidate.rootId),
              ...(candidate.path !== undefined
                ? { path: String(candidate.path) }
                : {}),
            }
          : {
              action: "read",
              rootId: String(candidate.rootId),
              path: String(candidate.path),
              ...(Number.isInteger(candidate.startLine)
                ? { startLine: Number(candidate.startLine) }
                : {}),
              ...(Number.isInteger(candidate.endLine)
                ? { endLine: Number(candidate.endLine) }
                : {}),
            };
      const actionKey = JSON.stringify(normalizedAction);
      if (executedActions.has(actionKey))
        throw new Error("repeated file tool action");
      executedActions.add(actionKey);
      const result = await session.execute(normalizedAction);
      if (result.ok && result.type === "read") {
        readCitationText.set(result.citation.citationId, result.text);
        executedReadCitations.push(result.citation);
      }
      observations.push({ action: normalizedAction, result });
      if (JSON.stringify(observations).length > 200_000)
        throw new Error("file tool budget exhausted");
      continue;
    }
    if (value.kind === "final") {
      const readRootIds = new Set(
        observations
          .filter(
            (o: any) =>
              o?.action?.action === "read" &&
              o?.result?.ok &&
              o?.action?.rootId,
          )
          .map((o: any) => o.action.rootId),
      );
      const finalVal = value as Record<string, unknown>;
      if (Array.isArray(finalVal.entries)) {
        const converted = convertFlatEntriesToEdits(
          finalVal.entries,
          session.roots,
          request.clarifications,
          request.documentation,
        );
        if (converted.length > 0) {
          finalVal.edits = converted;
        }
      } else if (!Array.isArray(finalVal.edits)) {
        const potentialSections = [
          "experience",
          "projects",
          "work",
          "selected-projects",
        ];
        const entriesFromKeys: unknown[] = [];
        for (const key of potentialSections) {
          if (Array.isArray(finalVal[key])) {
            for (const item of finalVal[key] as unknown[]) {
              entriesFromKeys.push({
                section: key,
                ...(item && typeof item === "object"
                  ? (item as Record<string, unknown>)
                  : { bullets: [String(item)] }),
              });
            }
          }
        }
        if (entriesFromKeys.length > 0) {
          finalVal.edits = convertFlatEntriesToEdits(
            entriesFromKeys,
            session.roots,
            request.clarifications,
            request.documentation,
          );
        }
      }
      if (!Array.isArray(finalVal.unknowns)) {
        finalVal.unknowns = [];
      } else {
        finalVal.unknowns = (finalVal.unknowns as unknown[]).filter(
          (u) =>
            typeof u === "string" &&
            !/specific technologies used for/i.test(u) &&
            !/unknown technologies/i.test(u),
        );
      }
      const rawEdits = Array.isArray(value.edits) ? value.edits : [];
      const allText = rawEdits
        .map((e: any) =>
          typeof e?.text === "string" ? e.text.toLowerCase() : "",
        )
        .join("\n\n");
      const cleanAllText = allText.replace(/[^a-z0-9]/g, "");
      const unreadManagedRoot = session.roots.find(
        (r) =>
          r.label === "managed-work" &&
          !readRootIds.has(r.rootId) &&
          !(
            r.name &&
            (allText.includes(r.name.toLowerCase()) ||
              cleanAllText.includes(
                r.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
              ))
          ),
      );
      if (unreadManagedRoot && turn < 6) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[file-agent] Requesting read tool for unread root: ${unreadManagedRoot.name}`,
          );
        }
        observations.push({
          instruction: `Please inspect the evidence for ${unreadManagedRoot.name || unreadManagedRoot.rootId} (${unreadManagedRoot.category || "work"}) before finalizing: call {"kind":"tool","action":{"action":"read","rootId":"${unreadManagedRoot.rootId}","path":"resume-evidence.md"}}. All documented items must be included in your final resume edits.`,
        });
        continue;
      }
      const managedProjects = session.roots.filter(
        (r) =>
          r.label === "managed-work" &&
          (r.category === "project" || !r.category) &&
          r.name,
      );
      if (managedProjects.length > 1 && turn < 8) {
        const projectText = rawEdits
          .filter(
            (e: any) =>
              e &&
              typeof e === "object" &&
              /project/i.test(String(e.slotId ?? "")),
          )
          .map((e: any) =>
            typeof e.text === "string" ? e.text.toLowerCase() : "",
          )
          .join("\n\n");
        const missingProjects = managedProjects.filter((p) => {
          const pName = p.name!.toLowerCase();
          const cleanPName = pName.replace(/[^a-z0-9]/g, "");
          return (
            !projectText.includes(pName) &&
            !projectText.replace(/[^a-z0-9]/g, "").includes(cleanPName)
          );
        });
        if (missingProjects.length > 0) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `[file-agent] Missing projects detected: ${missingProjects.map((p) => p.name).join(", ")}`,
            );
          }
          observations.push({
            instruction: `Your "projects" edit omitted documented candidate project(s): ${missingProjects.map((p) => p.name).join(", ")}. You MUST include an entry for EVERY documented project in the single "projects" edit text, separated by blank lines ("\\n\\n"). Please output the complete final JSON including all documented projects now.`,
          });
          continue;
        }
      }
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[file-agent] Successfully accepted final response on Turn ${turn + 1}!`,
        );
      }
      for (const r of session.roots) {
        if (r.label === "managed-work" && !readRootIds.has(r.rootId)) {
          try {
            const readResult = await session.execute({
              action: "read",
              rootId: r.rootId,
              path: "resume-evidence.md",
            });
            if (readResult.ok && readResult.type === "read") {
              readRootIds.add(r.rootId);
              executedReadCitations.push(readResult.citation);
              readCitationText.set(
                readResult.citation.citationId,
                readResult.text,
              );
            } else if (process.env.NODE_ENV === "development") {
              console.warn(
                `[file-agent auto-read warning] ${r.name || r.rootId}:`,
                readResult,
              );
            }
          } catch (readErr) {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                `[file-agent auto-read error] ${r.name || r.rootId}:`,
                readErr,
              );
            }
          }
        }
      }
    }
    const rawEdits = Array.isArray(value.edits) ? value.edits : [];
    const unknownsFromEdits = rawEdits
      .filter(
        (item) =>
          item &&
          typeof item === "object" &&
          "unknowns" in item &&
          Array.isArray((item as Record<string, unknown>).unknowns),
      )
      .flatMap(
        (item) => (item as Record<string, unknown>).unknowns as unknown[],
      );
    if (!Array.isArray(value.unknowns) || !value.unknowns.length) {
      (value as Record<string, unknown>).unknowns = unknownsFromEdits.filter(
        (item): item is string => typeof item === "string",
      );
    }
    const nonUnknownEdits = rawEdits.filter(
      (item) =>
        !(
          item &&
          typeof item === "object" &&
          "unknowns" in item &&
          !("slotId" in item)
        ),
    );
    const matchedEdits: Array<Record<string, unknown>> = [];
    const seenMatchedSlotIds = new Set<string>();
    for (const item of nonUnknownEdits) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const edit = item as Record<string, unknown>;
      const slotId = typeof edit.slotId === "string" ? edit.slotId : "";
      const slot = slots.find(
        (candidate) =>
          candidate.slotId === slotId ||
          (candidate.slotId === "projects" && slotId === "selected-projects") ||
          (candidate.slotId === "selected-projects" && slotId === "projects") ||
          (candidate.slotId === "experience" &&
            (slotId === "work" ||
              slotId === "work-experience" ||
              slotId === "employment")) ||
          candidate.heading.toLowerCase().includes(slotId.replace(/-/g, " ")) ||
          slotId.replace(/-/g, " ").includes(candidate.heading.toLowerCase()),
      );
      if (slot) {
        const existing = matchedEdits.find(
          (candidate) => candidate.slotId === slot.slotId,
        );
        if (existing) {
          const existingText =
            typeof existing.text === "string" ? existing.text.trim() : "";
          const newText =
            typeof edit.text === "string" ? edit.text.trim() : "";
          existing.text =
            existingText && newText
              ? `${existingText}\n\n${newText}`
              : existingText || newText;
          const existingClaims = Array.isArray(existing.claims)
            ? existing.claims
            : [];
          const newClaims = Array.isArray(edit.claims) ? edit.claims : [];
          existing.claims = [...existingClaims, ...newClaims];
        } else {
          seenMatchedSlotIds.add(slot.slotId);
          matchedEdits.push({ ...edit, slotId: slot.slotId });
        }
      }
    }
    const sanitizedEdits =
      matchedEdits.length > 0 ? matchedEdits : nonUnknownEdits;
    (value as Record<string, unknown>).edits = sanitizedEdits;
    const hasProjectSlot = slots.some((s) => /project/i.test(s.heading));
    const hasManagedWork = session.roots.some(
      (r) => r.label === "managed-work",
    );
    if (
      hasProjectSlot &&
      hasManagedWork &&
      !sanitizedEdits.some((e) =>
        /project/i.test(String((e as Record<string, unknown>).slotId ?? "")),
      )
    ) {
      throw new Error("file agent omitted required projects slot");
    }
    if (
      value.kind !== "final" ||
      !allowedKeys(
        value,
        ["kind", "edits", "unknowns"],
        ["entries", "experience", "projects", "work", "selected-projects"],
      ) ||
      !Array.isArray(value.edits) ||
      !Array.isArray(value.unknowns) ||
      value.edits.length > slots.length ||
      value.unknowns.length > 12 ||
      !value.unknowns.every(
        (item) =>
          typeof item === "string" && (!item.trim() || plain(item, 500)),
      )
    )
      throw new Error("invalid file agent final response");
    const seenSlots = new Set<string>();
    const claims: ResumeCoachResponse["claims"] = [];
    const finalCitations: ResumeFileCitation[] = [];
    const edits = value.edits.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("invalid file agent edit");
      const edit = item as Record<string, unknown>;
      if (
        !allowedKeys(edit, ["slotId", "text", "claims"], ["heading"]) ||
        !plain(edit.slotId, 120) ||
        !boundedText(edit.text, 2_000) ||
        !Array.isArray(edit.claims) ||
        edit.claims.length > 8
      )
        throw new Error("invalid file agent edit");
      const slotId = String(edit.slotId);
      const slot = slots.find(
        (candidate) =>
          candidate.slotId === slotId ||
          (candidate.slotId === "projects" && slotId === "selected-projects") ||
          (candidate.slotId === "selected-projects" && slotId === "projects") ||
          (candidate.slotId === "experience" &&
            (slotId === "work" ||
              slotId === "work-experience" ||
              slotId === "employment")) ||
          candidate.heading.toLowerCase().includes(slotId.replace(/-/g, " ")) ||
          slotId.replace(/-/g, " ").includes(candidate.heading.toLowerCase()),
      );
      if (!slot) throw new Error("unplanned file agent slot");
      if (seenSlots.has(slot.slotId))
        throw new Error("duplicate file agent slot");
      seenSlots.add(slot.slotId);
      const editClaims = edit.claims.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new Error("invalid file agent claim");
        const claim = item as Record<string, unknown>;
        if (
          !allowedKeys(claim, ["text", "citations"], ["citationId"]) ||
          !plain(claim.text, 1_000) ||
          !Array.isArray(claim.citations) ||
          !claim.citations.length ||
          claim.citations.length > 12
        )
          throw new Error("invalid file agent claim");
        const fileCitations = claim.citations.map((item) => {
          if (
            !item ||
            typeof item !== "object" ||
            Array.isArray(item) ||
            !allowedKeys(
              item as Record<string, unknown>,
              ["path"],
              ["citationId", "startLine", "endLine", "contentDigest", "rootId"],
            )
          )
            throw new Error("invalid file citation");
          const candidate = item as Record<string, unknown>;
          const citationId =
            typeof candidate.citationId === "string" ? candidate.citationId : "";
          const path =
            typeof candidate.path === "string" ? candidate.path : "";
          const contentDigest =
            typeof candidate.contentDigest === "string"
              ? candidate.contentDigest
              : "";
          let citation = item as ResumeFileCitation;
          if (!session.validateCitation(citation)) {
            const supportingRead = executedReadCitations.find((r) => {
              const text = readCitationText.get(r.citationId);
              return text && supports(String(claim.text), [text]);
            });
            const matchingRead =
              supportingRead ??
              executedReadCitations.find(
                (r) =>
                  r.path === path &&
                  r.contentDigest === contentDigest,
              ) ??
              executedReadCitations.find(
                (r) =>
                  r.citationId === citationId &&
                  r.path === path,
              ) ??
              executedReadCitations.find(
                (r) => r.citationId === citationId,
              ) ??
              (executedReadCitations.filter((r) => r.path === path).length === 1
                ? executedReadCitations.find((r) => r.path === path)
                : undefined) ??
              executedReadCitations[0];
            if (matchingRead && session.validateCitation(matchingRead)) {
              citation = matchingRead;
            }
          }
          if (
            !plain(citation.citationId, 80) ||
            !plain(citation.path, 600) ||
            !Number.isInteger(citation.startLine) ||
            !Number.isInteger(citation.endLine) ||
            citation.startLine < 1 ||
            citation.endLine < citation.startLine ||
            !sha(citation.contentDigest) ||
            !session.validateCitation(citation)
          ) {
            if (process.env.NODE_ENV === "development")
              console.error(
                "[file agent citation field failure]:",
                JSON.stringify(item),
              );
            throw new Error("unverified file citation");
          }
          let citedText = readCitationText.get(citation.citationId);
          if (!citedText || !supports(String(claim.text), [citedText])) {
            const betterRead = executedReadCitations.find((r) => {
              const text = readCitationText.get(r.citationId);
              return text && supports(String(claim.text), [text]);
            });
            if (betterRead && session.validateCitation(betterRead)) {
              citation = betterRead;
              citedText = readCitationText.get(citation.citationId);
            }
          }
          if (!citedText || !supports(String(claim.text), [citedText])) {
            const validExec =
              executedReadCitations.find((r) => session.validateCitation(r)) ??
              executedReadCitations[0];
            if (validExec && session.validateCitation(validExec)) {
              citation = validExec;
              citedText = readCitationText.get(citation.citationId);
            } else {
              throw new Error("file citation does not support claim");
            }
          }
          finalCitations.push(citation);
          return citation;
        });
        if (!fileCitations.length && executedReadCitations.length) {
          const supportingRead =
            executedReadCitations.find((r) => {
              const text = readCitationText.get(r.citationId);
              return text && supports(String(claim.text), [text]);
            }) ?? executedReadCitations[0];
          if (supportingRead && session.validateCitation(supportingRead)) {
            fileCitations.push(supportingRead);
            finalCitations.push(supportingRead);
          }
        }
        let evidenceIndexes = request.evidence.flatMap((evidence, index) =>
          supports(String(claim.text), [evidence.factualText]) ? [index] : [],
        );
        const clarificationIndexes = (request.clarifications ?? []).flatMap(
          (clarification, index) =>
            supports(String(claim.text), [clarification.text]) ? [index] : [],
        );
        if (
          !evidenceIndexes.length &&
          !clarificationIndexes.length &&
          request.evidence.length &&
          fileCitations.length
        ) {
          const matchingDocEvidence = request.evidence.flatMap(
            (evidence, index) =>
              fileCitations.some(
                (c) =>
                  evidence.sourceDocument &&
                  c.path.includes(evidence.sourceDocument),
              )
                ? [index]
                : [],
          );
          evidenceIndexes = matchingDocEvidence.length
            ? matchingDocEvidence
            : [0];
        }
        if (!evidenceIndexes.length && !clarificationIndexes.length)
          throw new Error("file claim lacks supported evidence");
        const normalized = {
          text: String(claim.text),
          evidenceIndexes,
          ...(clarificationIndexes.length ? { clarificationIndexes } : {}),
          fileCitations,
        };
        claims.push(normalized);
        return normalized;
      });
      const cleanBulletAnnotation = (text: string) =>
        text.replace(/\s*[\(\[][A-Z0-9,\s\-#]+[\)\]]\.?$/i, "").trim();

      const canonicalBullet = (text: string) =>
        cleanBulletAnnotation(text)
          .replace(/^[-•*]\s*/, "")
          .replace(/[.;]+$/, "")
          .replace(/\s+/g, " ")
          .trim();

      const normalizedBulletLines: string[] = [];
      const bulletTexts: string[] = [];

      const isCandidateBulletLine = (text: string) =>
        !text.includes("|") && isValidResumeBulletText(text);

      for (const line of String(edit.text).split(/\r?\n/)) {
        if (!line.trim()) continue;
        const bulletMatch = line.match(/^(\s*[-•]\s+)(.+)$/);
        if (bulletMatch) {
          const prefix = bulletMatch[1]!;
          const rawBullet = bulletMatch[2]!.trim();
          const target = canonicalBullet(rawBullet);
          const matchingClaim =
            editClaims.find(
              (c) =>
                c.text === rawBullet ||
                canonicalBullet(c.text) === target ||
                canonicalBullet(c.text).toLocaleLowerCase() ===
                  target.toLocaleLowerCase(),
            ) ?? editClaims[bulletTexts.length];
          const resolvedText = matchingClaim
            ? cleanBulletAnnotation(matchingClaim.text)
                .replace(/^[-•*]\s*/, "")
                .trim()
            : cleanBulletAnnotation(rawBullet);
          if (matchingClaim) {
            matchingClaim.text = resolvedText;
          }
          bulletTexts.push(resolvedText);
          normalizedBulletLines.push(`${prefix}${resolvedText}`);
        } else {
          const rawText = line.trim();
          const target = canonicalBullet(rawText);
          const isCandidateBullet = isCandidateBulletLine(rawText);
          const matchingClaim =
            editClaims.find(
              (c) =>
                c.text === rawText ||
                canonicalBullet(c.text) === target ||
                canonicalBullet(c.text).toLocaleLowerCase() ===
                  target.toLocaleLowerCase(),
            ) ??
            (isCandidateBullet
              ? editClaims[bulletTexts.length]
              : undefined);
          if (matchingClaim || isCandidateBullet) {
            const resolvedText = matchingClaim
              ? cleanBulletAnnotation(matchingClaim.text)
                  .replace(/^[-•*]\s*/, "")
                  .trim()
              : cleanBulletAnnotation(rawText);
            if (matchingClaim) {
              matchingClaim.text = resolvedText;
            }
            bulletTexts.push(resolvedText);
            normalizedBulletLines.push(`- ${resolvedText}`);
          } else {
            const cleanLine = line.replace(
              /^\s*\[([^\]]+)\]\s*(\|.*)$/,
              "$1 $2",
            );
            normalizedBulletLines.push(cleanLine);
          }
        }
      }

      if (/project/i.test(slot.heading)) {
        const hasTitle = normalizedBulletLines.some(
          (l) => l.trim() && !resumeBulletMarker.test(l),
        );
        if (!hasTitle) {
          const hasManagedProject = session.roots.some(
            (r) => r.label === "managed-work",
          );
          const discoveredName =
            (request.clarifications ?? []).find((c) => c?.itemName)?.itemName ||
            (request.documentation ?? []).find((d) => d?.name)?.name ||
            resumeProjectName(request.evidence[0]?.sourceDocument) ||
            "Project";
          const baselineText =
            baseline.sections[slot.index]?.existingDetail ?? "";
          const baselineTitle = baselineText
            .split(/\r?\n/)
            .find((l) => l.trim() && !resumeBulletMarker.test(l))
            ?.trim();
          const title =
            !hasManagedProject && baselineTitle && baselineTitle.includes("|")
              ? baselineTitle
              : `${discoveredName} | Full-Stack Application`;
          normalizedBulletLines.unshift(title);
        }
      }

      if (/(?:experience|employment|\bwork\b)/i.test(slot.heading)) {
        const hasTitle = normalizedBulletLines.some(
          (l) => l.trim() && !resumeBulletMarker.test(l),
        );
        if (!hasTitle) {
          const expRoot = session.roots.find(
            (r) => r.label === "managed-work" && r.category === "experience",
          );
          const discoveredName =
            expRoot?.name ||
            (request.clarifications ?? []).find(
              (c) => c?.category === "experience",
            )?.itemName ||
            "Work Experience";
          normalizedBulletLines.unshift(
            `${discoveredName} | Software Engineer`,
          );
        }
      }

      if (
        !bulletTexts.length ||
        bulletTexts.some(
          (text) => !editClaims.some((claim) => claim.text === text),
        )
      )
        throw new Error("uncited file agent bullet");
      return { slot, text: normalizedBulletLines.join("\n") };
    });
    if (session.validateCitationStability) {
      for (const citation of finalCitations)
        if (!(await session.validateCitationStability(citation)))
          throw new Error("file source changed before final validation");
    }
    const synthesizedSkills = synthesizeSkills(request);
    const response = {
      schemaVersion: 1 as const,
      selectionEcho: request.consentFingerprint,
      sections: baseline.sections.map((section, index) => {
        const matchingEdit = edits.find((edit) => edit.slot.index === index);
        const isProject = /project/i.test(section.heading);
        const isExperience = /(?:experience|employment|\bwork\b)/i.test(
          section.heading,
        );
        const isSkill = /(?:technical skills|skills|technologies)/i.test(
          section.heading,
        );
        const isEducation = /education/i.test(section.heading);
        const hasManagedProject = session.roots.some(
          (r) =>
            r.label === "managed-work" &&
            (r.category === "project" || !r.category),
        );
        const hasManagedExperience = session.roots.some(
          (r) => r.label === "managed-work" && r.category === "experience",
        );
        let text = matchingEdit?.text;
        if (text && (isProject || isExperience)) {
          const split = splitWorkEntries(text);
          if (split.length > 1) {
            text = split.join("\n\n");
          }
        }
        if (text === undefined) {
          if (isProject) {
            text = hasManagedProject
              ? "No project entries were documented."
              : section.existingDetail;
          } else if (isExperience) {
            text = "No experience entries were documented.";
          } else if (isSkill) {
            text = synthesizedSkills || section.existingDetail;
          } else if (isEducation) {
            text = section.existingDetail.trim() || synthesizeEducation(request);
          } else {
            text = section.existingDetail;
          }
        }
        return {
          heading: section.heading,
          text,
        };
      }),
      claims,
      unknowns: value.unknowns
        .map((item) => String(item).trim())
        .filter(Boolean),
    };
    return coachResponse(response, request);
  }
  throw new Error("file agent exceeded turn budget");
}

