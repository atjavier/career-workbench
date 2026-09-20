import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createResumeWorkspace } from "../src/domain/resume-generation/resume-workspace-commands";
import { readResumeWorkspaceState } from "../src/domain/resume-generation/resume-workspace-commands";
import {
  interpretWorkspaceEvidence,
  parseCuratedFacts,
  planClarifications,
} from "../src/domain/resume-generation/resume-evidence-interpretation";
import {
  beginResumeInterviewCoachStream,
  finalizeResumeInterviewCoachStream,
  readBoundedResumeInterviewContext,
  readBoundedResumeInterviewTranscript,
  readResumeClarificationInterview,
  recordResumeInterviewCoachTurn,
  respondToResumeClarification,
} from "../src/domain/resume-generation/resume-clarification-interview";
import { listClarifiedEvidenceInDatabase } from "../src/domain/resume-generation/resume-clarified-evidence";
import { openDatabase } from "../src/persistence/database";
import { writeWorkspaceClarificationPacket } from "../src/domain/resume-generation/resume-evidence-packets";

const digest = `sha256:${"a".repeat(64)}`;
const initialArtifact = `# Resume Evidence (Proposed / Unreviewed)

### E-001
- Fact: Built a local TypeScript tool.
- Provenance: README.md, Overview, line 2
- Explicit unknowns: Ownership, metrics, users, dates, deployment status, outcomes, and skills are not established by this source line.
- Status: Proposed / unreviewed`;

test("clarification planning keeps absent material details as questions", () => {
  const planned = planClarifications(
    "BioEvidence",
    "Built a local application.",
  );
  assert.ok(planned.some((task) => task.category === "purpose"));
  assert.ok(planned.some((task) => task.category === "users_workflow"));
  assert.ok(planned.some((task) => task.category === "metrics"));
  assert.ok(planned.every((task) => task.question.includes("BioEvidence")));
});

test("clarification planning does not repeat directly documented context", () => {
  const planned = planClarifications(
    "BioEvidence",
    "I developed the project in AY 2025-2026 for researchers. Its purpose was to support their workflow; 21 respondents gave a usability score. The team deployed a local demo.",
  );
  for (const category of [
    "purpose",
    "ownership",
    "users_workflow",
    "metrics",
    "deployment",
    "collaboration",
    "dates",
  ] as const)
    assert.ok(!planned.some((task) => task.category === category));
});

test("only provenance-backed facts are parsed; context, candidates, and explicit unknowns remain non-facts", () => {
  const facts = parseCuratedFacts(
    `${initialArtifact}\n\n# Resume Bullet Candidates (Proposed / Unreviewed)\n\n- Purpose: Not directly evidenced.\n- Candidate: Built a local TypeScript tool.\n- Supporting evidence: E-001`,
    "resume-evidence/projects/tool/resume-evidence.md",
  );
  assert.deepEqual(facts, [
    {
      fact: "Built a local TypeScript tool.",
      unknowns:
        "Ownership, metrics, users, dates, deployment status, outcomes, and skills are not established by this source line.",
      sourcePath: "resume-evidence/projects/tool/resume-evidence.md",
    },
  ]);
  const planned = planClarifications(
    "Tool",
    facts.map((fact) => fact.fact).join("\n"),
  );
  for (const category of [
    "purpose",
    "users_workflow",
    "metrics",
    "deployment",
  ] as const)
    assert.ok(planned.some((task) => task.category === category));
});

test("interpretation persists only curated facts, re-plans pending tasks, and refuses a switched workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-interpretation-"));
  const appDataRoot = join(root, "private");
  const artifactPath = join(
    root,
    "resume-evidence",
    "projects",
    "BioEvidence",
    "resume-evidence.md",
  );
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Evidence test",
    });
    await mkdir(join(artifactPath, ".."), { recursive: true });
    await writeFile(artifactPath, initialArtifact);
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO evidence_library_imports (id, category, source_identity, source_digest, library_root, created_at) VALUES (?, 'project', ?, ?, 'resume-evidence', ?)",
      ).run("import-1", "documented:project:bioevidence", digest, now);
      db.prepare(
        "INSERT INTO resume_workspace_imports (workspace_id, import_id) VALUES (?, 'import-1')",
      ).run(workspace.workspace.id);
      db.prepare(
        "INSERT INTO evidence_library_documents (id, import_id, category, library_path, content_digest, imported_at) VALUES (?, 'import-1', 'project', ?, ?, ?)",
      ).run(
        "document-1",
        "resume-evidence/projects/BioEvidence/resume-evidence.md",
        digest,
        now,
      );
    } finally {
      db.close();
    }

    assert.equal(
      await interpretWorkspaceEvidence(workspace.workspace.id, {
        appDataRoot,
        workspaceRoot: root,
      }),
      true,
    );
    assert.equal(
      (await readResumeWorkspaceState({ appDataRoot })).activeWorkspace?.journey
        ?.phase,
      "interview",
    );
    const verify = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const direct = verify
        .prepare(
          "SELECT content FROM resume_evidence_interpretations WHERE kind = 'direct_fact'",
        )
        .all() as Array<{ content: string }>;
      assert.equal(direct.length, 1);
      assert.equal(direct[0]?.content, "Built a local TypeScript tool.");
      assert.equal(
        (
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_clarification_tasks WHERE category = 'metrics' AND status = 'pending'",
            )
            .get() as { value: number }
        ).value,
        1,
      );
    } finally {
      verify.close();
    }

    await writeFile(
      artifactPath,
      `# Resume Evidence (Proposed / Unreviewed)

### E-001
- Fact: I developed this student project in AY 2025-2026 with a team to address researchers' workflow; a 21-respondent evaluation showed it delivered a local demo.
- Provenance: README.md, Overview, line 2
- Explicit unknowns: No additional unknowns.
- Status: Proposed / unreviewed`,
    );
    assert.equal(
      await interpretWorkspaceEvidence(workspace.workspace.id, {
        appDataRoot,
        workspaceRoot: root,
      }),
      true,
    );
    assert.equal(
      (await readResumeWorkspaceState({ appDataRoot })).activeWorkspace?.journey
        ?.phase,
      "ready_to_generate",
    );
    const replanned = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          replanned
            .prepare(
              "SELECT count(*) AS value FROM resume_clarification_tasks WHERE status = 'pending'",
            )
            .get() as { value: number }
        ).value,
        0,
      );
    } finally {
      replanned.close();
    }
    assert.equal(
      await interpretWorkspaceEvidence("00000000-0000-7000-8000-000000000000", {
        appDataRoot,
        workspaceRoot: root,
      }),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Coach Resume persists workspace-owned answers and explicit skips in task order", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-interview-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Interview",
    });
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const now = new Date().toISOString();
      for (const [id, category] of [
        ["task-1", "purpose"],
        ["task-2", "outcome"],
      ] as const)
        db.prepare(
          "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:bio', 'BioEvidence', 'project', ?, ?, ?)",
        ).run(id, workspace.workspace.id, category, `Question ${id}`, now);
    } finally {
      db.close();
    }
    assert.equal(
      (
        await readResumeClarificationInterview(workspace.workspace.id, {
          appDataRoot,
        })
      )?.current?.id,
      "task-1",
    );
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "task-1",
      answer: "I designed the workflow for researchers.",
    });
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "task-2",
      skip: true,
    });
    const after = await readResumeClarificationInterview(
      workspace.workspace.id,
      { appDataRoot },
    );
    assert.equal(after?.remaining, 0);
    assert.deepEqual(
      after?.completed.map((task) => [task.id, task.status, task.answer]),
      [
        ["task-1", "answered", "I designed the workflow for researchers."],
        ["task-2", "skipped", undefined],
      ],
    );
    await assert.rejects(
      respondToResumeClarification({
        appDataRoot,
        workspaceId: workspace.workspace.id,
        taskId: "task-1",
        answer: "Again",
      }),
      { code: "RESUME_COACH_INVALID" },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("accepted Coach answers become item-owned candidate evidence while skips stay explicit gaps", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-clarified-evidence-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Clarified",
    });
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO resume_evidence_interpretations (id, workspace_id, item_key, item_name, item_category, kind, content, evidence_document_path, created_at) VALUES (?, ?, 'project:bio', 'BioEvidence', 'project', 'direct_fact', 'The project was deployed to production.', 'resume-evidence/projects/BioEvidence/resume-evidence.md', ?)",
      ).run("fact-1", workspace.workspace.id, now);
      for (const [id, category] of [
        ["task-deployment", "deployment"],
        ["task-metric", "metrics"],
      ] as const)
        db.prepare(
          "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:bio', 'BioEvidence', 'project', ?, ?, ?)",
        ).run(id, workspace.workspace.id, category, `Question ${id}`, now);
    } finally {
      db.close();
    }
    const exactAnswer = "  It was never deployed to production.  ";
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "task-deployment",
      answer: exactAnswer,
    });
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "task-metric",
      skip: true,
    });
    const verify = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const clarified = listClarifiedEvidenceInDatabase(
        verify,
        workspace.workspace.id,
      );
      assert.deepEqual(
        clarified.map((item) => [
          item.itemName,
          item.category,
          item.candidateText,
          item.provenance,
          item.needsReview,
        ]),
        [
          [
            "BioEvidence",
            "deployment",
            exactAnswer,
            "candidate_interview_answer",
            true,
          ],
        ],
      );
      assert.equal(
        Number(
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_clarified_evidence_conflicts WHERE workspace_id = ?",
            )
            .get(workspace.workspace.id).value,
        ),
        1,
      );
    } finally {
      verify.close();
    }
    const after = await readResumeClarificationInterview(
      workspace.workspace.id,
      { appDataRoot },
    );
    assert.equal(
      after?.completed.find((task) => task.id === "task-deployment")
        ?.needsReview,
      true,
    );
    assert.equal(
      after?.completed.find((task) => task.id === "task-metric")?.needsReview,
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("workspace clarification packets preserve source evidence and keep answer and skip context separate", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-evidence-packet-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Packet",
    });
    const packet = join(
      root,
      "resume-evidence",
      "workspaces",
      workspace.workspace.id,
      "projects",
      "BioEvidence",
    );
    const evidencePath = join(packet, "resume-evidence.md");
    await mkdir(packet, { recursive: true });
    await writeFile(evidencePath, initialArtifact);
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const now = new Date().toISOString();
      for (const [id, category] of [
        ["answer", "purpose"],
        ["skip", "metrics"],
      ] as const)
        db.prepare(
          "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:bio', 'BioEvidence', 'project', ?, ?, ?)",
        ).run(id, workspace.workspace.id, category, `Question ${id}`, now);
    } finally {
      db.close();
    }
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "answer",
      answer: "I designed the workflow.",
    });
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "skip",
      skip: true,
    });
    await writeWorkspaceClarificationPacket({
      appDataRoot,
      workspaceRoot: root,
      workspaceId: workspace.workspace.id,
      itemKey: "project:bio",
    });
    const companion = await (
      await import("node:fs/promises")
    ).readFile(join(packet, "resume-clarifications.md"), "utf8");
    assert.match(companion, /I designed the workflow\./);
    assert.match(companion, /Explicit unknown/);
    assert.match(companion, /candidate_interview_answer/);
    assert.equal(
      await (await import("node:fs/promises")).readFile(evidencePath, "utf8"),
      initialArtifact,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("streaming Coach messages persist the candidate once and the Coach only after finalization", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-coach-stream-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Stream",
    });
    const taskId = "task-stream";
    const requestId = "00000000-0000-7000-8000-000000000079";
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      db.prepare(
        "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:stream', 'Stream', 'project', 'purpose', 'What was your contribution?', ?)",
      ).run(taskId, workspace.workspace.id, new Date().toISOString());
    } finally {
      db.close();
    }
    const started = await beginResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      candidateContent: "Can you explain it?",
      streamRequestId: requestId,
    });
    assert.equal(started.question, "What was your contribution?");
    await assert.rejects(
      beginResumeInterviewCoachStream({
        appDataRoot,
        workspaceId: workspace.workspace.id,
        taskId,
        candidateContent: "Can you explain it?",
        streamRequestId: requestId,
      }),
      { code: "RESUME_COACH_INVALID" },
    );
    const concurrentId = "00000000-0000-7000-8000-000000000080";
    const concurrent = await Promise.allSettled([
      beginResumeInterviewCoachStream({
        appDataRoot,
        workspaceId: workspace.workspace.id,
        taskId,
        candidateContent: "Please clarify.",
        streamRequestId: concurrentId,
      }),
      beginResumeInterviewCoachStream({
        appDataRoot,
        workspaceId: workspace.workspace.id,
        taskId,
        candidateContent: "Please clarify.",
        streamRequestId: concurrentId,
      }),
    ]);
    assert.equal(
      concurrent.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      concurrent.filter((result) => result.status === "rejected").length,
      1,
    );
    const before = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          before
            .prepare(
              "SELECT count(*) AS count FROM resume_interview_candidate_turns",
            )
            .get() as { count: number }
        ).count,
        2,
      );
      assert.equal(
        (
          before
            .prepare("SELECT count(*) AS count FROM resume_interview_turns")
            .get() as { count: number }
        ).count,
        0,
      );
    } finally {
      before.close();
    }
    await finalizeResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      streamRequestId: requestId,
      coachContent: "What was your contribution?\nWhich part did you own?",
    });
    await finalizeResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      streamRequestId: requestId,
      coachContent: "What was your contribution?\nWhich part did you own?",
    });
    const result = await readResumeClarificationInterview(
      workspace.workspace.id,
      { appDataRoot },
    );
    assert.deepEqual(
      result?.turns.map((turn) => turn.role),
      ["candidate", "candidate", "coach"],
    );
    const next = await beginResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      candidateContent: "I have one more detail.",
      streamRequestId: "00000000-0000-7000-8000-000000000084",
    });
    assert.equal(next.clarificationUsed, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("only one independently finalized clarification persists per pending task", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "resume-coach-clarification-limit-"),
  );
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Clarification limit",
    });
    const taskId = "task-clarification-limit";
    const requestIds = [
      "00000000-0000-7000-8000-000000000085",
      "00000000-0000-7000-8000-000000000086",
    ];
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      db.prepare(
        "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:limit', 'Limit', 'project', 'ownership', 'What did you own?', ?)",
      ).run(taskId, workspace.workspace.id, new Date().toISOString());
    } finally {
      db.close();
    }
    for (const [index, streamRequestId] of requestIds.entries())
      await beginResumeInterviewCoachStream({
        appDataRoot,
        workspaceId: workspace.workspace.id,
        taskId,
        candidateContent: `Clarification ${index + 1}.`,
        streamRequestId,
      });
    const finalizations = await Promise.allSettled(
      requestIds.map((streamRequestId) =>
        finalizeResumeInterviewCoachStream({
          appDataRoot,
          workspaceId: workspace.workspace.id,
          taskId,
          streamRequestId,
          coachContent: "Which part did you own?",
        }),
      ),
    );
    assert.equal(
      finalizations.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      finalizations.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(
      (
        finalizations.find(
          (result) => result.status === "rejected",
        ) as PromiseRejectedResult
      ).reason.code,
      "RESUME_COACH_INVALID",
    );
    const verify = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        Number(
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_interview_turns WHERE workspace_id = ? AND task_id = ?",
            )
            .get(workspace.workspace.id, taskId).value,
        ),
        1,
      );
      assert.deepEqual(
        verify
          .prepare(
            "SELECT status FROM resume_interview_stream_reservations WHERE workspace_id = ? AND task_id = ? ORDER BY stream_request_id",
          )
          .all(workspace.workspace.id, taskId)
          .map((row) => row.status)
          .sort(),
        ["completed", "started"],
      );
    } finally {
      verify.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("terminal Coach decisions atomically persist their reply with an answer or explicit unknown", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-coach-terminal-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Terminal",
    });
    const taskId = "task-terminal";
    const requestId = "00000000-0000-4000-8000-000000000089";
    const skippedTaskId = "task-terminal-skip";
    const skippedRequestId = "00000000-0000-4000-8000-000000000091";
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const insert = db.prepare(
        "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:terminal', 'Terminal', 'project', ?, ?, ?)",
      );
      const now = new Date().toISOString();
      insert.run(
        taskId,
        workspace.workspace.id,
        "ownership",
        "What did you own?",
        now,
      );
      insert.run(
        skippedTaskId,
        workspace.workspace.id,
        "metrics",
        "What result did it achieve?",
        now,
      );
    } finally {
      db.close();
    }
    await beginResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      candidateContent: "I designed the validation workflow.",
      streamRequestId: requestId,
    });
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      answer: "I designed the validation workflow.",
      coachContent: "Thanks, that is clear.",
      streamRequestId: requestId,
    });
    await beginResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: skippedTaskId,
      candidateContent: "I do not know the result.",
      streamRequestId: skippedRequestId,
    });
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: skippedTaskId,
      skip: true,
      coachContent: "It is okay to leave that unknown.",
      streamRequestId: skippedRequestId,
    });
    const completed = await readResumeClarificationInterview(
      workspace.workspace.id,
      { appDataRoot },
    );
    assert.equal(
      completed?.completed.find((task) => task.id === taskId)?.answer,
      "I designed the validation workflow.",
    );
    assert.equal(
      completed?.completed.find((task) => task.id === skippedTaskId)?.status,
      "skipped",
    );
    assert.equal(
      completed?.turns.at(-1)?.content,
      "It is okay to leave that unknown.",
    );

    const verify = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      assert.deepEqual(
        verify
          .prepare(
            "SELECT disposition FROM resume_clarification_task_responses WHERE workspace_id = ? AND task_id = ?",
          )
          .all(workspace.workspace.id, skippedTaskId)
          .map((row) => row.disposition),
        ["skipped"],
      );
      assert.equal(
        verify
          .prepare(
            "SELECT content FROM resume_interview_turns WHERE stream_request_id = ?",
          )
          .get(skippedRequestId).content,
        "It is okay to leave that unknown.",
      );
      assert.equal(
        verify
          .prepare(
            "SELECT status FROM resume_interview_stream_reservations WHERE stream_request_id = ?",
          )
          .get(skippedRequestId).status,
        "completed",
      );
    } finally {
      verify.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed terminal Coach persistence leaves the task and transcript unchanged", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-coach-terminal-failure-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Terminal failure",
    });
    const taskId = "task-terminal-failure";
    const requestId = "00000000-0000-4000-8000-000000000090";
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      db.prepare(
        "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:failure', 'Failure', 'project', 'ownership', 'What did you own?', ?)",
      ).run(taskId, workspace.workspace.id, new Date().toISOString());
    } finally {
      db.close();
    }
    await beginResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      candidateContent: "I owned it.",
      streamRequestId: requestId,
    });
    const fail = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      fail.exec(`CREATE TRIGGER fail_terminal_coach_insert
        BEFORE INSERT ON resume_interview_turns
        WHEN NEW.stream_request_id = '00000000-0000-4000-8000-000000000090'
        BEGIN
          SELECT RAISE(FAIL, 'forced terminal failure');
        END;`);
    } finally {
      fail.close();
    }
    await assert.rejects(
      respondToResumeClarification({
        appDataRoot,
        workspaceId: workspace.workspace.id,
        taskId,
        answer: "I owned it.",
        coachContent: "Thanks.",
        streamRequestId: requestId,
      }),
      /forced terminal failure/,
    );
    const unchanged = await readResumeClarificationInterview(
      workspace.workspace.id,
      { appDataRoot },
    );
    assert.equal(unchanged?.current?.id, taskId);
    assert.deepEqual(
      unchanged?.turns.map((turn) => turn.role),
      ["candidate"],
    );
    const verify = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        Number(
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_clarification_task_responses WHERE workspace_id = ? AND task_id = ?",
            )
            .get(workspace.workspace.id, taskId).value,
        ),
        0,
      );
      assert.equal(
        Number(
          verify
            .prepare(
              "SELECT count(*) AS value FROM resume_interview_turns WHERE workspace_id = ? AND task_id = ?",
            )
            .get(workspace.workspace.id, taskId).value,
        ),
        0,
      );
      assert.equal(
        verify
          .prepare(
            "SELECT status FROM resume_clarification_tasks WHERE workspace_id = ? AND id = ?",
          )
          .get(workspace.workspace.id, taskId).status,
        "pending",
      );
      assert.equal(
        verify
          .prepare(
            "SELECT status FROM resume_interview_stream_reservations WHERE stream_request_id = ?",
          )
          .get(requestId).status,
        "started",
      );
    } finally {
      verify.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("completed chat answers appear once while the next task becomes current", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-coach-next-task-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Next task",
    });
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const now = new Date().toISOString();
      const insert = db.prepare(
        "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, ?, 'Next task', 'project', 'purpose', ?, ?)",
      );
      insert.run(
        "task-complete",
        workspace.workspace.id,
        "project:task-complete",
        "What did you build?",
        now,
      );
      insert.run(
        "task-next",
        workspace.workspace.id,
        "project:task-next",
        "Who used it?",
        now,
      );
    } finally {
      db.close();
    }
    await beginResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "task-complete",
      candidateContent: "I built the complete workflow.",
      streamRequestId: "00000000-0000-7000-8000-000000000082",
    });
    await finalizeResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "task-complete",
      streamRequestId: "00000000-0000-7000-8000-000000000082",
      coachContent: "Would you like to add or clarify anything else?",
    });
    await respondToResumeClarification({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId: "task-complete",
      answer: "I built the complete workflow.",
    });
    const interview = await readResumeClarificationInterview(
      workspace.workspace.id,
      { appDataRoot },
    );
    assert.equal(interview?.current?.id, "task-next");
    assert.equal(
      interview?.turns.filter(
        (turn) => turn.content === "I built the complete workflow.",
      ).length,
      1,
    );
    assert.equal(
      interview?.turns.at(-1)?.content,
      "Would you like to add or clarify anything else?",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Coach Resume opens a new task without creating a candidate message", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-coach-opening-"));
  const appDataRoot = join(root, "private");
  try {
    const workspace = await createResumeWorkspace({
      appDataRoot,
      name: "Opening",
    });
    const taskId = "task-opening";
    const requestId = "00000000-0000-7000-8000-000000000081";
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      db.prepare(
        "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES (?, ?, 'project:opening', 'Opening', 'project', 'purpose', 'What was your contribution?', ?)",
      ).run(taskId, workspace.workspace.id, new Date().toISOString());
    } finally {
      db.close();
    }
    const started = await beginResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      candidateContent: "",
      opening: true,
      streamRequestId: requestId,
    });
    assert.deepEqual(started.transcript, []);
    const before = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      assert.equal(
        (
          before
            .prepare(
              "SELECT count(*) AS count FROM resume_interview_candidate_turns",
            )
            .get() as { count: number }
        ).count,
        0,
      );
    } finally {
      before.close();
    }
    await finalizeResumeInterviewCoachStream({
      appDataRoot,
      workspaceId: workspace.workspace.id,
      taskId,
      streamRequestId: requestId,
      coachContent:
        "I will help clarify your documented experience. What was your contribution?",
      opening: true,
    });
    const result = await readResumeClarificationInterview(
      workspace.workspace.id,
      { appDataRoot },
    );
    assert.deepEqual(
      result?.turns.map((turn) => turn.role),
      ["coach"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Coach Resume context is bounded to the active workspace and current task item", async () => {
  const root = await mkdtemp(join(tmpdir(), "resume-coach-context-"));
  const appDataRoot = join(root, "private");
  try {
    const first = await createResumeWorkspace({ appDataRoot, name: "First" });
    const db = openDatabase(join(appDataRoot, "workspace.sqlite"));
    try {
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO resume_clarification_tasks (id, workspace_id, item_key, item_name, item_category, category, question, created_at) VALUES ('task-context', ?, 'project:one', 'One', 'project', 'purpose', 'Question', ?)",
      ).run(first.workspace.id, now);
      db.prepare(
        "INSERT INTO resume_evidence_interpretations (id, workspace_id, item_key, item_name, item_category, kind, content, evidence_document_path, created_at) VALUES ('fact-context', ?, 'project:one', 'One', 'project', 'direct_fact', 'Workspace one fact', 'safe.md', ?)",
      ).run(first.workspace.id, now);
    } finally {
      db.close();
    }
    assert.deepEqual(
      await readBoundedResumeInterviewContext(
        first.workspace.id,
        "task-context",
        { appDataRoot },
      ),
      ["Workspace one fact"],
    );
    await recordResumeInterviewCoachTurn({
      appDataRoot,
      workspaceId: first.workspace.id,
      taskId: "task-context",
      candidateContent: "Can you explain this?",
      coachContent: "Question\nwith a follow-up",
    });
    assert.deepEqual(
      await readBoundedResumeInterviewTranscript(
        first.workspace.id,
        "task-context",
        { appDataRoot },
      ),
      ["Candidate: Can you explain this?", "Coach: Question with a follow-up"],
    );
    assert.deepEqual(
      (
        await readResumeClarificationInterview(first.workspace.id, {
          appDataRoot,
        })
      )?.turns.map((turn) => turn.role),
      ["candidate", "coach"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
