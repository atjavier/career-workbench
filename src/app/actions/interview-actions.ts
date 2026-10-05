"use server";

import { requestResumeInterviewCoach, resumeInterviewCoachConsentFingerprint } from "@/adapters/local-model/local-model-gateway";
import { readLocalModelGatewayConfiguration } from "@/domain/resume-generation/local-model-configuration-commands";
import { readBoundedResumeInterviewContext, readBoundedResumeInterviewTranscript, readResumeClarificationInterview, recordResumeInterviewCoachTurn, respondToResumeClarification } from "@/domain/resume-generation/resume-clarification-interview";
import { toSafeWorkspaceError, WorkspaceError } from "@/domain/workspace/types";
import { revalidatePath } from "next/cache";
import type { ResumeInterviewActionState } from "./action-state";

export async function resumeClarificationAction(
  _: ResumeInterviewActionState,
  formData: FormData,
): Promise<ResumeInterviewActionState> {
  try {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const taskId = String(formData.get("taskId") ?? "");
    const skip = formData.get("command") === "skip";
    await respondToResumeClarification({
      workspaceId,
      taskId,
      answer: String(formData.get("answer") ?? ""),
      skip,
    });
    revalidatePath("/resume/interview");
    revalidatePath("/resume");
    return {
      status: "success",
      summary: skip
        ? "Coach Resume recorded this as an explicit unknown and moved to the next question."
        : "Answer saved. Coach Resume moved to the next question.",
    };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

export async function resumeInterviewCoachAction(
  _: ResumeInterviewActionState,
  formData: FormData,
): Promise<ResumeInterviewActionState> {
  try {
    const workspaceId = String(formData.get("workspaceId") ?? "");
    const consentNonce = String(formData.get("consentNonce") ?? "");
    const candidateContent = String(formData.get("message") ?? "").trim();
    if (
      !consentNonce ||
      consentNonce.length > 120 ||
      !candidateContent ||
      candidateContent.length > 1200 ||
      /[\u0000-\u001f\u007f-\u009f]/.test(candidateContent)
    )
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "Write a concise message before explicitly sending it to local Coach Resume.",
        "Review the local-only disclosure and try again.",
      );
    const interview = await readResumeClarificationInterview(workspaceId);
    const task = interview?.current;
    if (!task)
      throw new WorkspaceError(
        "RESUME_COACH_INVALID",
        "There is no saved clarification question ready for Coach Resume.",
        "Return to the interview after evidence planning is complete.",
      );
    const configuration = await readLocalModelGatewayConfiguration();
    const connection = {
      configurationRevisionId: configuration.id,
      configurationDigest: configuration.configurationDigest,
      modelIdentifier: configuration.modelIdentifier,
    };
    const [context, transcript] = await Promise.all([
      readBoundedResumeInterviewContext(workspaceId, task.id),
      readBoundedResumeInterviewTranscript(workspaceId, task.id),
    ]);
    const input = {
      connection,
      workspaceId,
      taskId: task.id,
      question: task.question,
      context,
      transcript: [...transcript, `Candidate: ${candidateContent}`].slice(-20),
      consentNonce,
    };
    const reply = await requestResumeInterviewCoach({
      ...input,
      consentFingerprint: resumeInterviewCoachConsentFingerprint(input),
    });
    const coachContent = reply.followUp
      ? `${reply.question} ${reply.followUp}`
      : reply.question;
    await recordResumeInterviewCoachTurn({
      workspaceId,
      taskId: task.id,
      candidateContent,
      coachContent,
    });
    revalidatePath("/resume/interview");
    revalidatePath("/resume");
    return {
      status: "success",
      summary:
        "Coach Resume replied. Your saved answer or skip remains the only way to complete this question.",
    };
  } catch (error) {
    const safe = toSafeWorkspaceError(error);
    return {
      status: "error",
      summary: safe.summary,
      safeNextAction: safe.safeNextAction,
    };
  }
}

