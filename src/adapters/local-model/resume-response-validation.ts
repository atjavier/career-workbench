import { containsUnsafeResumeContent } from "@/adapters/local-model/resume-generator-agent";
import type { ResumeTemplateContract } from "@/domain/base-resume/resume-template-contract";
import type { ResumeCandidateClarification, ResumeCoachRequest, ResumeCoachResponse } from "./local-model-contracts";
import { boundedText, exactKeys, maxResponse, maxResumeCoachEvidence, plain, sha, supports, uuid, validConnection } from "./model-boundaries";
import { invalid, resumeCoachConsentFingerprint } from "./model-consent";
import { resumeBulletMarker } from "./resume-composition";



export function validCoach(request: ResumeCoachRequest) {
  const opportunity = request.opportunity;
  const validOpportunity =
    !opportunity ||
    (uuid(opportunity.revisionId) &&
      sha(opportunity.contentDigest) &&
      plain(opportunity.title, 300) &&
      plain(opportunity.company, 300) &&
      plain(opportunity.copiedDescription, 20_000) &&
      Array.isArray(opportunity.requirements) &&
      opportunity.requirements.length > 0 &&
      opportunity.requirements.length <= 20 &&
      opportunity.requirements.every((item) => plain(item, 1_000)));
  const documentation = request.documentation ?? [];
  const baseline = request.baseline;
  const clarifications = request.clarifications ?? [];
  const validBaseline =
    !baseline ||
    (uuid(baseline.baselineId) &&
      sha(baseline.baselineDigest) &&
      baseline.sections.length >= 2 &&
      baseline.sections.length <= 8 &&
      new Set(baseline.sections.map((section) => section.tag)).size ===
        baseline.sections.length &&
      baseline.sections.every(
        (section) =>
          plain(section.heading, 120) &&
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.tag) &&
          typeof section.existingDetail === "string" &&
          section.existingDetail.length <= 900 &&
          !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(
            section.existingDetail,
          ),
      ));
  if (
    !validConnection(request.connection) ||
    !plain(request.userRequest, 2_000) ||
    !plain(request.profileSnapshot, 4_000) ||
    !plain(request.consentNonce, 128) ||
    !uuid(request.profileRevisionId) ||
    !sha(request.profileDigest) ||
    !uuid(request.templateId) ||
    !sha(request.templateDigest) ||
    !sha(request.consentFingerprint) ||
    !request.evidence.length ||
    request.evidence.length > maxResumeCoachEvidence ||
    request.evidence.some(
      (item) =>
        !uuid(item.id) ||
        !plain(item.factualText, 4_000) ||
        !sha(item.contentDigest) ||
        (item.sourceDocument !== undefined &&
          !plain(item.sourceDocument, 600)) ||
        (item.sourceSection !== undefined && !plain(item.sourceSection, 600)),
    ) ||
    documentation.length > 24 ||
    documentation.some(
      (group) =>
        !plain(group.name, 240) ||
        (group.category !== "project" && group.category !== "experience") ||
        !group.documents.length ||
        group.documents.length > 24 ||
        group.documents.some(
          (document) =>
            !plain(document.path, 600) ||
            document.path.includes("..") ||
            document.path.includes("\\") ||
            !boundedText(document.text, 12_000) ||
            !sha(document.contentDigest),
        ),
    ) ||
    !validBaseline ||
    clarifications.length > 24 ||
    clarifications.some(
      (clarification) =>
        !exactKeys(clarification as Record<string, unknown>, [
          "itemName",
          "itemCategory",
          "category",
          "text",
          "provenance",
        ]) ||
        !plain(clarification.itemName, 240) ||
        (clarification.itemCategory !== "project" &&
          clarification.itemCategory !== "experience") ||
        !plain(clarification.category, 120) ||
        !plain(clarification.text, 2_400) ||
        clarification.provenance !== "candidate_interview_answer",
    ) ||
    (request.currentResumeSections !== undefined &&
      (!request.currentResumeSections.length ||
        request.currentResumeSections.length > 8 ||
        request.currentResumeSections.some(
          (section) =>
            !plain(section.heading, 120) || !boundedText(section.text, 2_000),
        ))) ||
    !validOpportunity
  )
    invalid("The selected local material cannot be sent safely.");
  if (request.consentFingerprint !== resumeCoachConsentFingerprint(request))
    invalid(
      "The local-model consent is no longer current.",
      "Review the disclosure and submit the request again.",
    );
}


export function isWorkSection(heading: string): boolean {
  return /(?:experience|employment|\bwork\b|project)/i.test(heading);
}


function isExactEmptyBaselineSection(
  section: Record<string, unknown>,
  baseline: ResumeTemplateContract | undefined,
): boolean {
  return (
    Boolean(baseline) &&
    typeof section.text === "string" &&
    !section.text.trim() &&
    baseline!.sections.some(
      (baselineSection) =>
        baselineSection.heading === String(section.heading) &&
        !baselineSection.existingDetail.trim(),
    )
  );
}


function visibleWorkBullets(
  sections: Array<{ heading: string; text: string }>,
): string[] {
  return sections
    .filter((section) => isWorkSection(section.heading))
    .flatMap((section) =>
      section.text
        .split("\n")
        .map((line) => /^\s*(?:[-*•])\s+(.+?)\s*$/.exec(line)?.[1])
        .filter((line): line is string => Boolean(line)),
    );
}


const comparableClaim = (value: string) =>
  value.trim().replace(/\s+/g, " ").replace(/[.]+$/, "").toLocaleLowerCase();


function everyVisibleWorkBulletIsClaimed(
  sections: Array<{ heading: string; text: string }>,
  claims: Array<{ text: string }>,
  baseline?: ResumeTemplateContract,
): boolean {
  const sectionsToCheck = baseline
    ? sections.filter((section) => {
        const baselineSection = baseline.sections.find(
          (candidate) =>
            candidate.heading.trim().toLowerCase() ===
            section.heading.trim().toLowerCase(),
        );
        return (
          !baselineSection ||
          section.text.trim() !== baselineSection.existingDetail.trim()
        );
      })
    : sections;
  return visibleWorkBullets(sectionsToCheck).every((bullet) =>
    claims.some(
      (claim) => comparableClaim(claim.text) === comparableClaim(bullet),
    ),
  );
}


function inferVisibleWorkClaims(
  sections: Array<{ heading: string; text: string }>,
  evidence: ResumeCoachRequest["evidence"],
  clarifications: ResumeCandidateClarification[],
): ResumeCoachResponse["claims"] {
  return visibleWorkBullets(sections).map((text) => {
    const clarificationIndexes = clarifications
      .flatMap((item, index) => (supports(text, [item.text]) ? [index] : []))
      .slice(0, 4);
    return {
      text,
      evidenceIndexes: evidence
        .flatMap((item, index) =>
          supports(text, [item.factualText]) ? [index] : [],
        )
        .slice(0, 4),
      ...(clarificationIndexes.length ? { clarificationIndexes } : {}),
    };
  });
}


export function splitWorkEntries(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: string[] = [];
  let current: string[] = [];
  let seenBullets = false;
  for (const line of lines) {
    const isBullet = resumeBulletMarker.test(line);
    if (!isBullet && seenBullets && current.length > 0) {
      entries.push(current.join("\n"));
      current = [line];
      seenBullets = false;
    } else {
      current.push(line);
      if (isBullet) seenBullets = true;
    }
  }
  if (current.length) entries.push(current.join("\n"));
  return entries;
}


const conversationalResumePrefix =
  /^(?:The\b|This\b|These\b|Those\b|Here\b|Sure\b|Certainly\b|Note\b|Please\b|As\s+a\b|In\s+this\b|I\s+(?:was|worked|am|have|did|helped)\b)/i;


export function isValidResumeBulletText(bullet: string): boolean {
  const trimmed = bullet.trim();
  if (!trimmed) return false;
  if (conversationalResumePrefix.test(trimmed)) return false;
  if (containsUnsafeResumeContent(trimmed)) return false;
  // Professional resume bullets begin with a capitalized word (e.g. action verb)
  // rather than conversational filler, lowercase fragments, or raw symbols.
  if (!/^[A-Z0-9][a-zA-Z0-9-]*\b/.test(trimmed)) return false;
  return trimmed.split(/\s+/).length >= 3;
}


function specialistStructureIsValid(
  response: ResumeCoachResponse,
  baseline: ResumeTemplateContract | undefined,
): boolean {
  if (!baseline) return true;
  if (
    response.sections.length !== baseline.sections.length ||
    response.sections.some(
      (section, index) =>
        section.heading !== baseline.sections[index]?.heading ||
        containsUnsafeResumeContent(section.text),
    )
  )
    return false;
  return response.sections.every((section, index) => {
    const baselineSection = baseline.sections[index]!;
    const work = isWorkSection(section.heading);
    const isSkill = /(?:technical skills|skills|technologies)/i.test(
      section.heading,
    );
    if (isSkill) {
      if (section.text.trim() === baselineSection.existingDetail.trim()) {
        return !containsUnsafeResumeContent(section.text);
      }
      return (
        Boolean(section.text.trim()) &&
        !containsUnsafeResumeContent(section.text)
      );
    }
    const isEducation = /education/i.test(section.heading);
    if (isEducation) {
      if (section.text.trim() === baselineSection.existingDetail.trim()) {
        return !containsUnsafeResumeContent(section.text);
      }
      return (
        Boolean(section.text.trim()) &&
        !containsUnsafeResumeContent(section.text)
      );
    }
    if (!work) return section.text === baselineSection.existingDetail;
    if (section.text.trim() === baselineSection.existingDetail.trim())
      return true;
    const bullets = section.text
      .split(/\r?\n/)
      .filter((line) => resumeBulletMarker.test(line))
      .map((line) => line.replace(resumeBulletMarker, "").trim());
    if (!bullets.length)
      return (
        section.text === baselineSection.existingDetail ||
        !section.text.trim() ||
        /no (?:experience|employment)/i.test(section.text)
      );
    if (bullets.some((bullet) => !isValidResumeBulletText(bullet))) return false;
    if (/project/i.test(section.heading)) {
      const entries = splitWorkEntries(section.text);
      return (
        entries.length <= 4 &&
        entries.every((entry) => {
          const lines = entry.split(/\r?\n/).filter(Boolean);
          const title = lines.find(Boolean)?.trim() ?? "";
          const projectBullets = lines.filter((line) =>
            resumeBulletMarker.test(line),
          );
          const descriptorWords = title.includes("|")
            ? title.split("|")[1]!.trim().split(/\s+/).length
            : title.split(/\s+/).length;
          return (
            !resumeBulletMarker.test(title) &&
            descriptorWords <= 20 &&
            projectBullets.length <= 5 &&
            projectBullets.every(
              (bullet) =>
                bullet.replace(resumeBulletMarker, "").trim().split(/\s+/)
                  .length <= 45,
            )
          );
        })
      );
    }
    return true;
  });
}


export function coachResponse(
  value: unknown,
  request: ResumeCoachRequest,
): ResumeCoachResponse {
  const evidence = request.evidence;
  const fingerprint = request.consentFingerprint;
  const clarifications = request.clarifications ?? [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("The local model returned an unusable response.");
  const item = value as Record<string, unknown>;
  const sections = item.sections;
  const claims = item.claims;
  const unknowns = item.unknowns;
  // Some LM Studio Qwen builds omit the constant schemaVersion even when the
  // rest of the envelope is complete. Once the exact remaining envelope and
  // every field below validate, normalizing that omitted constant to version 1
  // is safe and prevents a good resume from degrading to the low-level fallback.
  const exactEnvelope = exactKeys(item, [
    "schemaVersion",
    "selectionEcho",
    "sections",
    "claims",
    "unknowns",
  ]);
  const omittedVersionEnvelope =
    item.schemaVersion === undefined &&
    exactKeys(item, ["selectionEcho", "sections", "claims", "unknowns"]);
  if (
    (!exactEnvelope && !omittedVersionEnvelope) ||
    (item.schemaVersion !== undefined && item.schemaVersion !== 1) ||
    item.selectionEcho !== fingerprint ||
    !Array.isArray(sections) ||
    !sections.length ||
    sections.length > 8 ||
    !Array.isArray(claims) ||
    claims.length > 20 ||
    !Array.isArray(unknowns) ||
    unknowns.length > 12
  )
    invalid("The local model returned an unsafe or incomplete response.");
  // A project-only workspace has no employment entry. Accept an intentionally
  // blank Experience section as an omitted section instead of discarding an
  // otherwise useful employer-facing project description.
  const populatedSections = request.baseline
    ? sections
    : sections.filter(
        (section) =>
          !(
            section &&
            typeof section === "object" &&
            /^experience$/i.test(
              String((section as Record<string, unknown>).heading ?? "").trim(),
            ) &&
            typeof (section as Record<string, unknown>).text === "string" &&
            !String((section as Record<string, unknown>).text).trim()
          ),
      );
  // Section text is intentionally multiline: the renderer turns its entry
  // title and bullets into the Resume.pdf-derived layout. `plain` rejects
  // newlines, which previously discarded well-formed model resumes and
  // forced the raw-fact fallback instead.
  if (process.env.NODE_ENV === "development") {
    if (!populatedSections.length)
      console.error("[coachResponse fail]: populatedSections empty");
    const badSection = populatedSections.find((section) => {
      if (!section || typeof section !== "object") return true;
      const candidate = section as Record<string, unknown>;
      return (
        !exactKeys(candidate, ["heading", "text"]) ||
        !plain(candidate.heading, 120) ||
        (!boundedText(candidate.text, 2_000) &&
          !isExactEmptyBaselineSection(candidate, request.baseline))
      );
    });
    if (badSection)
      console.error("[coachResponse fail badSection]:", badSection);
    const badClaim = claims.find((claim) => {
      if (!claim || typeof claim !== "object") return true;
      const rec = claim as Record<string, unknown>;
      if (
        !("text" in rec) ||
        !("evidenceIndexes" in rec) ||
        !plain(rec.text, 1_000)
      )
        return true;
      if (!Array.isArray(rec.evidenceIndexes)) return true;
      const cast = claim as {
        evidenceIndexes: unknown[];
        clarificationIndexes?: unknown[];
        fileCitations?: unknown[];
      };
      if (
        !cast.evidenceIndexes.length &&
        !cast.clarificationIndexes?.length &&
        !cast.fileCitations?.length
      )
        return true;
      return false;
    });
    if (badClaim) console.error("[coachResponse fail badClaim]:", badClaim);
  }
  if (
    !populatedSections.length ||
    populatedSections.some((section) => {
      if (!section || typeof section !== "object") return true;
      const candidate = section as Record<string, unknown>;
      return (
        !exactKeys(candidate, ["heading", "text"]) ||
        !plain(candidate.heading, 120) ||
        (!boundedText(candidate.text, 2_000) &&
          !isExactEmptyBaselineSection(candidate, request.baseline))
      );
    }) ||
    claims.some(
      (claim) =>
        !claim ||
        typeof claim !== "object" ||
        ![
          "text",
          "evidenceIndexes",
          "clarificationIndexes",
          "fileCitations",
        ].includes(
          Object.keys(claim as Record<string, unknown>).find(
            (key) =>
              ![
                "text",
                "evidenceIndexes",
                "clarificationIndexes",
                "fileCitations",
              ].includes(key),
          ) ?? "text",
        ) ||
        !("text" in (claim as Record<string, unknown>)) ||
        !("evidenceIndexes" in (claim as Record<string, unknown>)) ||
        !plain((claim as Record<string, unknown>).text, 1_000) ||
        !Array.isArray((claim as Record<string, unknown>).evidenceIndexes) ||
        (!Array.isArray(
          (claim as Record<string, unknown>).clarificationIndexes,
        ) &&
          (claim as Record<string, unknown>).clarificationIndexes !==
            undefined) ||
        (!(
          claim as {
            evidenceIndexes: unknown[];
            clarificationIndexes?: unknown[];
            fileCitations?: unknown[];
          }
        ).evidenceIndexes.length &&
          !(claim as { clarificationIndexes?: unknown[] }).clarificationIndexes
            ?.length &&
          !(claim as { fileCitations?: unknown[] }).fileCitations?.length) ||
        new Set((claim as { evidenceIndexes: unknown[] }).evidenceIndexes)
          .size !==
          (claim as { evidenceIndexes: unknown[] }).evidenceIndexes.length ||
        new Set(
          (claim as { clarificationIndexes?: unknown[] })
            .clarificationIndexes ?? [],
        ).size !==
          (
            (claim as { clarificationIndexes?: unknown[] })
              .clarificationIndexes ?? []
          ).length ||
        (claim as { evidenceIndexes: unknown[] }).evidenceIndexes.some(
          (index) =>
            !Number.isInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= evidence.length,
        ) ||
        (
          claim as { clarificationIndexes?: unknown[] }
        ).clarificationIndexes?.some(
          (index) =>
            !Number.isInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= clarifications.length,
        ),
    ) ||
    unknowns.some((unknown) => !plain(unknown, 500))
  )
    invalid("The local model returned unsupported guidance.");
  // A concise bullet may combine multiple supported clauses. Keep only the
  // citations that independently overlap the visible bullet, then reject the
  // claim entirely if no evidence or eligible clarification remains.
  const groundedClaims = (claims as ResumeCoachResponse["claims"]).map(
    (claim) => {
      const evidenceIndexes = claim.evidenceIndexes.filter((index) =>
        supports(claim.text, [evidence[index]?.factualText ?? ""]),
      );
      const clarificationIndexes = (claim.clarificationIndexes ?? []).filter(
        (index) => supports(claim.text, [clarifications[index]?.text ?? ""]),
      );
      return {
        text: claim.text,
        evidenceIndexes,
        ...(clarificationIndexes.length ? { clarificationIndexes } : {}),
        ...(claim.fileCitations?.length
          ? { fileCitations: claim.fileCitations }
          : {}),
      };
    },
  );
  const ungrounded = groundedClaims.filter(
    (claim) =>
      !claim.evidenceIndexes.length &&
      !claim.clarificationIndexes?.length &&
      !claim.fileCitations?.length,
  );
  if (ungrounded.length) {
    console.error(
      "[coachResponse ungrounded claims]:",
      JSON.stringify(ungrounded, null, 2),
    );
    invalid("The local model returned unsupported guidance.");
  }
  const inferredClaims = claims.length
    ? groundedClaims
    : inferVisibleWorkClaims(
        populatedSections as ResumeCoachResponse["sections"],
        evidence,
        clarifications,
      );
  const result = {
    schemaVersion: 1 as const,
    sections: populatedSections as ResumeCoachResponse["sections"],
    claims: inferredClaims,
    unknowns: unknowns as string[],
    selectionEcho: fingerprint,
  };
  if (process.env.NODE_ENV === "development") {
    const claimsOk = inferredClaims.every(
      (claim) =>
        claim.evidenceIndexes.length ||
        claim.clarificationIndexes?.length ||
        claim.fileCitations?.length,
    );
    const visibleOk = everyVisibleWorkBulletIsClaimed(
      result.sections,
      result.claims,
      request.baseline,
    );
    const structureOk = specialistStructureIsValid(result, request.baseline);
    if (!claimsOk || !visibleOk || !structureOk) {
      console.error("[coachResponse validation failed]:", {
        claimsOk,
        visibleOk,
        structureOk,
        claims: result.claims,
        sections: result.sections,
      });
    }
  }
  if (
    !inferredClaims.every(
      (claim) =>
        claim.evidenceIndexes.length ||
        claim.clarificationIndexes?.length ||
        claim.fileCitations?.length,
    ) ||
    !everyVisibleWorkBulletIsClaimed(
      result.sections,
      result.claims,
      request.baseline,
    ) ||
    !specialistStructureIsValid(result, request.baseline)
  )
    invalid(
      "The local model returned a draft that does not follow the supported resume contract.",
    );
  if (JSON.stringify(result).length > maxResponse)
    invalid("The local model response is too large to review safely.");
  return result;
}
