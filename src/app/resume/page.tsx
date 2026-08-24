import { ApplicationShell } from "@/app/application-shell";
import { ResumeWorkspace } from "@/app/resume-workspace";

export const dynamic = "force-dynamic";

export default function ResumePage() { return <ApplicationShell active="Resume"><ResumeWorkspace /></ApplicationShell>; }
