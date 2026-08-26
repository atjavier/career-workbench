import { ApplicationShell } from "@/app/application-shell";
import { LocalModelSettings } from "@/app/local-model-settings";
import { readLocalModelReadiness } from "@/domain/resume-generation/local-model-configuration-commands";

export const dynamic = "force-dynamic";

export default async function SettingsPage() { const readiness = await readLocalModelReadiness(); return <ApplicationShell active="Settings"><div className="workspace-shell"><LocalModelSettings ready={readiness.ready} /></div></ApplicationShell>; }
