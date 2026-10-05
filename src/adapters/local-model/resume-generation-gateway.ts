import { orchestrateResumeGeneration } from "@/adapters/local-model/resume-generation-orchestrator";
import { containsUnsafeResumeContent, resumeGeneratorSystemInstruction } from "@/adapters/local-model/resume-generator-agent";
import { WorkspaceError } from "@/domain/workspace/types";
import type { FetchLike, ResumeCoachDocumentation, ResumeCoachRequest, ResumeCoachResponse, ResumeProfileSnapshot } from "./local-model-contracts";
import { maxRequest, maxResponse, supports } from "./model-boundaries";
import { invalid } from "./model-consent";
import { native } from "./native-transport";
import { profileValue, resumeProjectName, synthesizeEducation, synthesizeSkills } from "./resume-composition";
import { isBoilerplateEvidence } from "./resume-documentation-gateway";
import { requestFileAgentResume } from "./resume-file-gateway";
import { coachResponse, isValidResumeBulletText, validCoach } from "./resume-response-validation";

export function resumeRelevantModelEvidence(
  evidence: ResumeCoachRequest["evidence"],
): Array<{ index: number; factualText: string; contentDigest: string }> {
  const score = (value: string) =>
    (
      value.match(
        /\b(?:workflow|validate|validation|sqlite|durable|cancel|evidence|predictor|classification|variant|vcf|result|upload)\b/gi,
      ) ?? []
    ).length;
  return evidence
    .flatMap((item, index) => {
      const source = item.factualText.trim();
      if (
        /`|(?:^|\s)(?:docs|src|tests|node_modules)\/|\b(?:get|post|put|patch|delete)\s+\/|\b(?:insert into|logger=|command:|story key|setup\.md)\b/i.test(
          source,
        )
      )
        return [];
      const factualText = /create a durable run record in sqlite/i.test(source)
        ? "Created durable SQLite-backed run records for the documented analysis workflow."
        : /allow canceling a run with a durable, guarded state transition/i.test(
              source,
            )
          ? "Implemented guarded run cancellation with durable workflow state."
          : /validate it immediately.*before any pipeline execution/i.test(
                source,
              )
            ? "Added immediate VCF validation feedback before analysis processing."
            : source;
      return [{ index, factualText, contentDigest: item.contentDigest }];
    })
    .sort(
      (left, right) =>
        score(right.factualText) - score(left.factualText) ||
        left.index - right.index,
    )
    .slice(0, 20);
}

function prioritizeCandidateBulletsInText(text: string): string {
  const candidateIdx = text.search(/##\s+Candidate Bullets/i);
  if (candidateIdx <= 0) return text;
  const doubleNewline = text.indexOf("\n\n");
  const header = doubleNewline >= 0 ? text.slice(0, doubleNewline + 2) : "";
  const candidatePart = text.slice(candidateIdx);
  const contextPart =
    doubleNewline >= 0
      ? text.slice(doubleNewline + 2, candidateIdx)
      : text.slice(0, candidateIdx);
  return `${header}${candidatePart}\n\n${contextPart}`;
}

function resumeGenerationDocumentation(
  documentation: ResumeCoachDocumentation[] | undefined,
): Array<{
  name: string;
  category: "project" | "experience";
  documents: Array<{ text: string; contentDigest: string }>;
}> {
  return (documentation ?? [])
    .map((group) => {
      const candidates = group.documents.find((document) =>
        /resume-bullet-candidates\.md$/i.test(document.path),
      );
      const evidence = group.documents.find((document) =>
        /resume-evidence\.md$/i.test(document.path),
      );
      const document = candidates
        ? {
            ...candidates,
            text: prioritizeCandidateBulletsInText(candidates.text).slice(0, 8_000),
          }
        : evidence
          ? { ...evidence, text: evidence.text.slice(0, 6_000) }
          : undefined;
      return document
        ? {
            name: group.name,
            category: group.category,
            documents: [
              { text: document.text, contentDigest: document.contentDigest },
            ],
          }
        : { name: group.name, category: group.category, documents: [] };
    })
    .filter((group) => group.documents.length > 0);
}

// Compatibility export: base-resume generation used to be incorrectly named
// "Resume Coach". The active generator now has its own persona and contract.
// Backward-compatible public name for callers that still use this export for
// the base-resume request. The separate review capability below uses its own
// Resume Coach prompt directly.
export const resumeCoachSystemInstruction = resumeGeneratorSystemInstruction;

function isInternalResumeManifest(text: string): boolean {
  return [
    /\b(?:os[- ]account|full[- ]disk encryption|device encryption|application-level encryption|credential vault|credential-boundary)\b/i,
    /\b(?:tokens? remain out of|private (?:per-user|os-user) app-data|sqlite.{0,100}\b(?:authoritative|local authority))\b/i,
    /\b(?:host-controlled (?:local )?(?:workflow|orchestration)|model-callable tools?|application contracts?)\b/i,
    /\bauthority to access\b.*\b(?:folder|skill file|shell|network|arbitrary tool)\b/i,
    /\b(?:evidence mining, candidate positioning|candidate positioning, recruiter judgement|writer or coach input)\b/i,
    /^(?:the )?(?:architecture|system design)\s+(?:follows|uses|is)\b/i,
    /^(?:the host (?:runs|validates|provides|persists)|resume writing follows|a project is described through|skills are extracted from|a workspace owns)\b/i,
    /^(?:ats-compatible base resume|credibility review, and resume copywriting)\b/i,
    /^(?:importing and preserving|managing a reviewed|maintaining a versioned|configuring role, country|recording permitted job-discovery|running explicit, bounded|preserving source-level)\b/i,
    /^(?:career workbench|resume architect)\s+(?:is|combines)\b/i,
    /^(?:the )?(?:application|product|workspace|system)\s+(?:is|runs|operates|addresses|manages)\b/i,
    /^(?:the )?(?:application|product|workspace|system)\s+provides\s+(?:a|an|the)\s+(?:private )?(?:workspace|platform|system)\b/i,
    /^(?:it|this)\s+(?:is designed|combines)\b/i,
  ].some((pattern) => pattern.test(text));
}

function readableEvidenceFact(factualText: string): string | undefined {
  const text = factualText.trim();
  const sourceLine = text.replace(/^[\s>*-]+/, "").trim();
  if (!text || isBoilerplateEvidence(text)) return undefined;
  // Folder documentation is useful source material, but never resume copy.
  // Keep only candidate-facing prose in the deterministic fallback.
  // Security policy, model-control doctrine, architecture, and product
  // manifests describe operating constraints rather than candidate work.
  if (isInternalResumeManifest(sourceLine)) return undefined;
  if (
    /(?:^|\s)(?:docs|src|tests|node_modules|scripts|config)[\\/]\S+/i.test(
      sourceLine,
    ) ||
    sourceLine.startsWith("id: SPEC-") ||
    sourceLine.endsWith(".md") ||
    /^\**status\s*:/i.test(sourceLine) ||
    /^expected weekly fields|^daily report supplies|^use this template|^these are concise walkthrough docs|^primary code|^story key/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (
    /^(?:user selects|user clicks|how-it-works docs|files inspected|project classification|source tree|entry point|story key|documentation set)\b/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (/^(?:[\w.-]+[\\/])+[\w.-]+\.[a-z0-9]+$/i.test(sourceLine))
    return undefined;
  if (
    /^\**(?:purpose|user or workflow|design rationale|directly stated outcome|explicit gaps|architecture or workflow|meaningful capabilities)\**\s*:/i.test(
      sourceLine,
    ) ||
    /^(?:name|description|repository shape|workflow version)\s*:/i.test(
      sourceLine,
    ) ||
    /^(?:[A-Z][A-Z0-9_]{2,})\s*(?:\(|=|:)/.test(sourceLine) ||
    /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/<>{}:.-]+/i.test(sourceLine)
  )
    return undefined;
  if (
    /^(?:raw |ui calls\b|client calls\b|server renders\b|route handler\b|schema is initialized\b|flask app factory\b|provide a minimal\b|allow canceling\b|upload \(|run the same\b)/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (
    /^(?:create(?:d)?|return(?:ed)?)\s+(?:a\s+)?durable\s+run\s+records?\b/i.test(
      sourceLine,
    )
  )
    return "Implemented durable run-state management for the documented analysis workflow.";
  if (
    /^(?:waitress|gunicorn|uvicorn)\b/i.test(sourceLine) ||
    /\b(?:no raw \w+ storage|via a JSON API|for development and runtime instructions)\b/i.test(
      sourceLine,
    )
  )
    return undefined;
  if (/^\*\*(?:backend|frontend):/i.test(text))
    return text.replaceAll("**", "");
  if (
    /^(?:["'][^"']+["']\s*:|[a-z][\w.-]*\s*:\s*(?:SPEC-|<)|insert\s+into\b|logger\s*=|command\s*:|primary\s+code\s*:|story\s+key|expected\s+weekly\s+fields|daily\s+report\s+supplies|use this template|these are concise walkthrough docs|docs\/)/i.test(
      text,
    ) ||
    /\.\.\//.test(text) ||
    /<[^>]+>/.test(text)
  )
    return undefined;
  if (
    /^\*\*(?:period evidenced|documented effort|organization|role):/i.test(text)
  )
    return undefined;
  const route =
    /\b(?:router|app)\.(get|post|put|patch|delete|use)\s*\(\s*["']([^"']+)["']/i.exec(
      text,
    );
  if (route)
    return route[1].toUpperCase() === "USE"
      ? `Configured Express middleware or route mounting for ${route[2]}.`
      : `Implemented a ${route[1].toUpperCase()} ${route[2]} endpoint.`;
  if (/mongoose\.connect/i.test(text))
    return "Connected the application to MongoDB through Mongoose.";
  if (/bcrypt\.(?:hash|compare)/i.test(text))
    return "Applied bcrypt password hashing or comparison in the authentication flow.";
  if (/\b(?:existingEmail|findOne\s*\(\s*\{\s*email)/i.test(text))
    return "Checked for an existing account email before registration.";
  if (/\b(?:const|let)\s+app\s*=\s*express\s*\(/i.test(text))
    return "Initialized an Express application.";
  if (/app\.use\s*\(\s*express\.json\s*\(/i.test(text))
    return "Configured JSON request parsing middleware.";
  if (/tokens remain out of the sqlite database/i.test(text))
    return "Kept integration tokens out of SQLite and assigned them to the OS credential vault.";
  const model =
    /(?:new\s+mongoose\.Schema|mongoose\.model\s*\(\s*["']([^"']+))/i.exec(
      text,
    );
  if (model)
    return model[1]
      ? `Defined and registered a Mongoose ${model[1]} data model.`
      : "Defined a Mongoose data schema.";
  const dependency =
    /^['"]?([@a-z0-9][@a-z0-9._/-]*)['"]?\s*:\s*["']?([^,'"\s]+|\^[^,'"\s]+)["']?,?$/i.exec(
      text,
    );
  if (
    dependency &&
    /^(?:express|mongoose|mongodb|bcrypt|cors|react|react-dom|vite|typescript|flask|waitress|supabase|sendgrid|swagger|bruno|concurrently|docker|sqlite|node)$/i.test(
      dependency[1],
    )
  )
    return `Configured the ${dependency[1]} dependency (${dependency[2]}).`;
  if (/\b(?:npm|yarn|pnpm)\s+(?:run\s+)?(?:dev|start|build|test)\b/i.test(text))
    return "Configured project development, build, test, or start workflow scripts.";
  if (
    /^test\s*\(/i.test(text) ||
    /\b(?:describe|it|expect|assert)\s*\(/i.test(text)
  )
    return "Added automated test coverage for a documented workflow.";
  // Raw assignments, imports, links, and object literals are useful source
  // evidence, but they are not readable resume bullets.
  if (
    /^(?:import|export|const|let|var|function|class)\b/i.test(text) ||
    /=>|[{};]/.test(text) ||
    /https?:\/\//i.test(text) ||
    /\b(?:docs|src|tests|node_modules|scripts|config)\/[\w./-]+/i.test(text)
  )
    return undefined;
  const cleaned = text
    .replace(/^[`*_]+|[`*_]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z.]+){1,3}$/.test(cleaned)) return undefined;
  if (
    cleaned.length < 24 ||
    /^(?:raw|ui|client|server|schema|route|configuration|environment|command)\b/i.test(
      cleaned,
    )
  )
    return undefined;
  return cleaned.length > 500
    ? `${cleaned.slice(0, 497).replace(/\s+\S*$/, "")}...`
    : cleaned;
}

function deterministicResumeCoachResponse(
  request: ResumeCoachRequest,
): ResumeCoachResponse {
  if (request.baseline) {
    const specialist = specialistFallback(request);
    if (specialist) return specialist;
    invalid(
      "A concise draft cannot be composed from the imported resume contract and supported work.",
      "Restore the initial resume baseline or add directly supported work, then try again.",
    );
  }
  let profile: ResumeProfileSnapshot = {};
  try {
    const parsed = JSON.parse(request.profileSnapshot);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      profile = parsed as ResumeProfileSnapshot;
  } catch {
    /* A legacy profile snapshot can still produce a work-focused draft. */
  }
  const name = [
    profileValue(profile.firstName),
    profileValue(profile.middleName),
    profileValue(profile.lastName),
  ]
    .filter(Boolean)
    .join(" ");
  const contact = [
    profileValue(profile.email),
    profileValue(profile.phone),
    profileValue(profile.linkedInUrl),
    profileValue(profile.githubUrl),
  ]
    .filter(Boolean)
    .join(" | ");
  const education = [
    profileValue(profile.program),
    profileValue(profile.school),
    profile.graduationYear !== undefined
      ? String(profile.graduationYear)
      : undefined,
    profileValue(profile.gwa) ? `GWA ${profileValue(profile.gwa)}` : undefined,
    profileValue(profile.latinHonors),
  ]
    .filter(Boolean)
    .join(" | ");
  const grouped = new Map<
    string,
    {
      category: "project" | "experience";
      facts: Array<{ text: string; index: number }>;
    }
  >();
  request.evidence.forEach((item, index) => {
    const fact = readableEvidenceFact(item.factualText);
    if (!fact) return;
    const key = resumeProjectName(item.sourceDocument);
    const category = /resume-evidence\/experiences\//i.test(
      item.sourceDocument ?? "",
    )
      ? "experience"
      : "project";
    const group = grouped.get(key) ?? { category, facts: [] };
    if (
      !group.facts.some((entry) => entry.text === fact) &&
      [...grouped.values()].flatMap((entry) => entry.facts).length < 20
    )
      group.facts.push({ text: fact, index });
    grouped.set(key, group);
  });
  const entriesFor = (category: "project" | "experience") =>
    [...grouped.entries()]
      .filter(([, group]) => group.category === category)
      .map(([name, group]) => {
        // Overview and summary documents are generator handoffs, not resume
        // content. Rendering either one verbatim is how source-tree and config
        // material leaked into the PDF after a model fallback.
        const facts = group.facts
          .slice(0, category === "experience" ? 5 : 4)
          .map((fact) => `- ${fact.text}`)
          .join("\n");
        return `${name}${facts ? `\n${facts}` : ""}`;
      });
  const experienceEntries = entriesFor("experience");
  const projectEntries = entriesFor("project");
  const supported = [...grouped.values()].flatMap((group) => group.facts);
  const claims = supported
    .slice(0, 20)
    .map((item) => ({ text: item.text, evidenceIndexes: [item.index] }));
  const projectText = experienceEntries.join("\n\n");
  const projectsText = projectEntries.join("\n\n");
  const skillCorpus = `${request.evidence.map((item) => item.factualText).join(" ")} ${(request.documentation ?? []).flatMap((group) => group.documents.map((document) => document.text)).join(" ")}`;
  const skillGroups = [
    ["Languages", ["TypeScript", "JavaScript", "Go", "Python", "C"]],
    [
      "Frameworks",
      [
        "React",
        "React Router",
        "Node.js",
        "Express",
        "Flask",
        "Vite",
        "Tailwind CSS",
      ],
    ],
    [
      "Data & APIs",
      [
        "MongoDB",
        "Mongoose",
        "SQLite",
        "Supabase",
        "REST APIs",
        "Server-Sent Events",
        "Swagger",
      ],
    ],
    [
      "Tools",
      [
        "Git",
        "GitHub",
        "Docker Compose",
        "Bruno",
        "SendGrid",
        "n8n",
        "Trello",
        "ClickUp",
      ],
    ],
  ]
    .map(
      ([label, names]) =>
        `${label}: ${(names as string[]).filter((item) => new RegExp(`\\b${item.replace(/[.+]/g, "\\$&")}\\b`, "i").test(skillCorpus)).join(", ")}`,
    )
    .filter((line) => !line.endsWith(": "));
  const sections = [
    ...(contact
      ? [{ heading: "Contact", text: `${name}\n${contact}` }]
      : name
        ? [{ heading: "Contact", text: name }]
        : []),
    ...(education ? [{ heading: "Education", text: education }] : []),
    ...(experienceEntries.length
      ? [{ heading: "Experience", text: projectText.slice(0, 2_000) }]
      : []),
    ...(projectEntries.length
      ? [{ heading: "Projects", text: projectsText.slice(0, 2_000) }]
      : []),
    ...(skillGroups.length
      ? [{ heading: "Technical Skills", text: skillGroups.join("\n") }]
      : []),
    ...(request.documentation?.length
      ? []
      : [
          {
            heading: "Selected Experience & Projects",
            text:
              claims.map((claim) => `- ${claim.text}`).join("\n") ||
              "No documented work was supplied.",
          },
        ]),
  ];
  return {
    schemaVersion: 1,
    selectionEcho: request.consentFingerprint,
    sections,
    claims,
    unknowns: [
      "Personal ownership, metrics, users, dates, outcomes, deployment status, and skills are included only where directly documented.",
    ],
  };
}

function specialistFallback(
  request: ResumeCoachRequest,
): ResumeCoachResponse | undefined {
  const baseline = request.baseline;
  if (!baseline) return undefined;
  const action = (value: string) => {
    const fact = readableEvidenceFact(value);
    if (!fact) return undefined;
    const rewritten = fact
      .replace(/^(?:It|I)\s+/i, "")
      .replace(/^built\b/i, "Developed")
      .replace(/^created\b/i, "Developed")
      .replace(/^added\b/i, "Implemented")
      .replace(/^configured\b/i, "Established")
      .replace(/^delivered\b/i, "Delivered")
      .replace(/[.]+$/, "");
    const capitalized = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);
    if (!isValidResumeBulletText(capitalized)) return undefined;
    const words = capitalized.split(/\s+/);
    return words.length > 30 ? words.slice(0, 30).join(" ") : capitalized;
  };
  const grouped = new Map<
    "project" | "experience",
    Array<
      | { name: string; text: string; evidenceIndex: number }
      | { name: string; text: string; clarificationIndex: number }
    >
  >([
    ["project", []],
    ["experience", []],
  ]);
  request.evidence.forEach((evidence, index) => {
    const text = action(evidence.factualText);
    if (!text || !supports(text, [evidence.factualText])) return;
    const category = /(?:^|\/)experiences\//i.test(
      evidence.sourceDocument ?? "",
    )
      ? "experience"
      : "project";
    grouped.get(category)!.push({
      name: resumeProjectName(evidence.sourceDocument),
      text,
      evidenceIndex: index,
    });
  });
  request.clarifications?.forEach((clarification, index) => {
    let text = action(clarification.text);
    if (!text && clarification.text.trim().length >= 10) {
      const clean = clarification.text
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[.]+$/, "");
      const withVerb = isValidResumeBulletText(clean)
        ? clean.charAt(0).toUpperCase() + clean.slice(1)
        : /^(?:i\s+)?built\b/i.test(clean)
          ? `Built ${clean.replace(/^(?:i\s+)?built\s+(?:it\s+)?/i, "")}`
          : /^(?:i\s+)?designed\b/i.test(clean)
            ? `Designed ${clean.replace(/^(?:i\s+)?designed\s+(?:it\s+)?/i, "")}`
            : /^(?:i\s+)?implemented\b/i.test(clean)
              ? `Implemented ${clean.replace(/^(?:i\s+)?implemented\s+(?:it\s+)?/i, "")}`
              : `Delivered ${clean.replace(/^(?:it\s+was\s+able\s+to\s+|it\s+was\s+made\s+to\s+|i\s+built\s+it\s+|i\s+)/i, "")}`;
      const words = withVerb.split(/\s+/);
      text = words.length > 30 ? words.slice(0, 30).join(" ") : withVerb;
    }
    if (!text) return;
    if (!supports(text, [clarification.text])) {
      const clean = clarification.text
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[.]+$/, "");
      const actionPrefixed = isValidResumeBulletText(clean)
        ? clean.charAt(0).toUpperCase() + clean.slice(1)
        : `Built ${clean.replace(/^(?:i\s+|it\s+was\s+)/i, "")}`;
      if (supports(actionPrefixed, [clarification.text])) {
        text = actionPrefixed;
      } else {
        return;
      }
    }
    grouped.get(clarification.itemCategory)!.push({
      name: clarification.itemName,
      text,
      clarificationIndex: index,
    });
  });
  const claims: ResumeCoachResponse["claims"] = [];
  const sections = baseline.sections.map((section) => {
    const isSkill = /(?:technical skills|skills|technologies)/i.test(
      section.heading,
    );
    if (isSkill) {
      const skills = synthesizeSkills(request) || section.existingDetail;
      return { heading: section.heading, text: skills };
    }
    const isEducation = /education/i.test(section.heading);
    if (isEducation) {
      const education =
        section.existingDetail.trim() || synthesizeEducation(request);
      return { heading: section.heading, text: education };
    }
    const category = /(?:experience|employment|work)/i.test(section.heading)
      ? "experience"
      : /project/i.test(section.heading)
        ? "project"
        : undefined;
    if (!category)
      return { heading: section.heading, text: section.existingDetail };
    const entries = grouped.get(category)!;
    const byName = new Map<
      string,
      Array<
        | { text: string; evidenceIndex: number }
        | { text: string; clarificationIndex: number }
      >
    >();
    const hasExperiences = (grouped.get("experience") ?? []).length > 0;
    const maxBulletsPerEntry = category === "project" && hasExperiences ? 2 : 3;
    const maxEntries = category === "project" && hasExperiences ? 3 : 4;
    for (const entry of entries) {
      const current = byName.get(entry.name) ?? [];
      if (current.length < maxBulletsPerEntry) current.push(entry);
      byName.set(entry.name, current);
    }
    const text = [...byName.entries()]
      .slice(0, maxEntries)
      .map(([name, facts]) => {
        for (const fact of facts)
          claims.push(
            "evidenceIndex" in fact
              ? { text: fact.text, evidenceIndexes: [fact.evidenceIndex] }
              : {
                  text: fact.text,
                  evidenceIndexes: [],
                  clarificationIndexes: [fact.clarificationIndex],
                },
          );
        const candidateProvided = facts.some(
          (fact) => "clarificationIndex" in fact,
        );
        const title =
          category === "project"
            ? `${name} | ${candidateProvided ? "Candidate-provided" : "Documented"} workflow`
            : `${name} | ${candidateProvided ? "Candidate-provided" : "Documented"} contribution`;
        return `${title}\n${facts.map((fact) => `- ${fact.text}`).join("\n")}`;
      })
      .join("\n\n");
    const hasCategoryEvidence = (request.evidence ?? []).some((item) =>
      category === "experience"
        ? /(?:^|\/)experiences\//i.test(item.sourceDocument ?? "")
        : !/(?:^|\/)experiences\//i.test(item.sourceDocument ?? ""),
    );
    return {
      heading: section.heading,
      text: text || (hasCategoryEvidence ? "" : section.existingDetail),
    };
  });
  if (!claims.length) {
    console.error(
      "[specialistFallback]: !claims.length is true (claims is empty)",
    );
    return undefined;
  }
  const response: ResumeCoachResponse = {
    schemaVersion: 1,
    sections,
    claims,
    unknowns: [
      "Candidate ownership, metrics, users, outcomes, dates, and technologies remain limited to supplied provenance.",
    ],
    selectionEcho: request.consentFingerprint,
  };
  try {
    return coachResponse(response, request);
  } catch (error) {
    console.error("[specialistFallback coachResponse error]:", error);
    return undefined;
  }
}

function containsResumeSourceLeak(
  response: ResumeCoachResponse,
  request: ResumeCoachRequest,
): boolean {
  const text = `${response.sections.map((section) => section.text).join("\n")}\n${response.claims.map((claim) => claim.text).join("\n")}`;
  const categories = new Set(
    (request.documentation ?? []).map((group) => group.category),
  );
  const projectEvidence = request.evidence.some((item) =>
    /resume-evidence\/projects\//i.test(item.sourceDocument ?? ""),
  );
  const experienceEvidence = request.evidence.some((item) =>
    /resume-evidence\/experiences\//i.test(item.sourceDocument ?? ""),
  );
  const headings = response.sections.map((section) => section.heading.trim());
  // Keep the same clear hierarchy as the reference resume: projects and
  // employment work are separate sections, never a blended project summary.
  const hasProjectSection = headings.some((heading) =>
    /(?:^|\b)(?:[a-z]+\s+)?projects?\b/i.test(heading),
  );
  const hasExperienceSection = headings.some((heading) =>
    /(?:^|\b)(?:[a-z]+\s+)?(?:experience|employment|work history)\b/i.test(
      heading,
    ),
  );
  const missingProjectSection =
    (categories.has("project") || projectEvidence) && !hasProjectSection;
  const missingExperienceSection =
    (categories.has("experience") || experienceEvidence) &&
    !hasExperienceSection;
  const unsafeContent = containsUnsafeResumeContent(text);
  const leakPattern =
    /(?:^|\n)\s*(?:[-•]\s*)?(?:SP[A-Z0-9_]*|[A-Z][A-Z0-9_]*_[A-Z0-9_]+)\s*(?:\(|=|:)|(?:^|\n)[^\n]*(?:for development and runtime instructions|see (?:the )?(?:code\/)?setup\.md|no raw [a-z ]+ storage|return it via a JSON API|create a durable run record)\b/im.test(
      text,
    );
  if (
    process.env.NODE_ENV === "development" &&
    (missingProjectSection ||
      missingExperienceSection ||
      unsafeContent ||
      leakPattern)
  ) {
    console.error("[resume-generation] source-leak guard triggered:", {
      missingProjectSection,
      missingExperienceSection,
      unsafeContent,
      leakPattern,
    });
  }
  return (
    missingProjectSection ||
    missingExperienceSection ||
    unsafeContent ||
    leakPattern
  );
}

function retainCandidateClarificationProvenance(
  response: ResumeCoachResponse,
  request: ResumeCoachRequest,
): ResumeCoachResponse {
  return request.clarifications?.length
    ? { ...response, candidateClarifications: request.clarifications }
    : response;
}

export async function requestBaseResumeGeneration(
  request: ResumeCoachRequest,
  fetcher: FetchLike = fetch,
): Promise<ResumeCoachResponse> {
  validCoach(request);
  if (request.fileReadSession) {
    try {
      return retainCandidateClarificationProvenance(
        await requestFileAgentResume(request, request.fileReadSession, fetcher),
        request,
      );
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[requestBaseResumeGeneration file agent fallback]:",
          error,
        );
      }
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    }
  }
  // Every current documented finding remains attached to the resulting draft.
  // A very large collection must not be sent to the loopback model, however:
  // use the same provenance-linked local composer rather than silently dropping
  // findings or surfacing a generic model-input error.
  if (JSON.stringify(request).length > maxRequest)
    return retainCandidateClarificationProvenance(
      deterministicResumeCoachResponse(request),
      request,
    );
  try {
    const modelEvidence = resumeRelevantModelEvidence(request.evidence);
    if (!modelEvidence.length)
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    const packetEvidence = modelEvidence.map(
      ({ index, factualText, contentDigest }) => ({
        evidenceIndex: index,
        factualText,
        contentDigest,
      }),
    );
    const packetDocumentation = resumeGenerationDocumentation(
      request.documentation,
    );
    const projectIdentities = (request.documentation ?? [])
      .filter((group) => group.category === "project")
      .map((group) => group.name);
    const baseline = request.baseline;
    if (!baseline)
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    const candidateClarifications = (request.clarifications ?? []).map(
      ({ itemName, itemCategory, category, text, provenance }, index) => ({
        clarificationIndex: index,
        itemName,
        itemCategory,
        category,
        text,
        provenance,
      }),
    );
    const generated = await orchestrateResumeGeneration(
      {
        baseline,
        selectionEcho: request.consentFingerprint,
        profile: request.profileSnapshot,
        evidence: packetEvidence,
        candidateClarifications,
        documentation: packetDocumentation,
        projectIdentities,
        opportunity: request.opportunity
          ? {
              title: request.opportunity.title,
              company: request.opportunity.company,
              requirements: request.opportunity.requirements,
              copiedDescription: request.opportunity.copiedDescription,
              contentDigest: request.opportunity.contentDigest,
            }
          : null,
        request: request.userRequest,
      },
      (instruction, packet, maximumTokens) =>
        native(
          request.connection,
          instruction,
          packet,
          maximumTokens,
          fetcher,
          "RESUME_COACH_UNAVAILABLE",
          maxResponse,
          "off",
        ),
    );
    const response = request.fileReadSession
      ? generated
      : coachResponse(generated, request);
    if (containsResumeSourceLeak(response, request)) {
      if (process.env.NODE_ENV === "development")
        console.error("[resume-generation] fallback: source-leak guard");
      return retainCandidateClarificationProvenance(
        deterministicResumeCoachResponse(request),
        request,
      );
    }
    return retainCandidateClarificationProvenance(response, request);
  } catch (error) {
    let reason = "unknown failure";
    if (error instanceof WorkspaceError) reason = error.code;
    else if (error instanceof Error) reason = error.message;
    if (process.env.NODE_ENV === "development")
      console.error(
        `[resume-generation] fallback: ${reason}${error instanceof Error && error.message ? ` (${error.message})` : ""}`,
      );
    return retainCandidateClarificationProvenance(
      deterministicResumeCoachResponse(request),
      request,
    );
  }
}

// Existing callers and persisted tests can migrate gradually. This is a base
// resume generator alias, not the interactive Resume Coach.
export const requestResumeCoach = requestBaseResumeGeneration;
