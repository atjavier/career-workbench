import { ApplicationShell } from "@/app/application-shell";
import { LocalModelSettings } from "@/app/local-model-settings";
import { DataStorage } from "@/app/data-storage";
import { listDataStorage } from "@/domain/data-storage/data-storage";
import { storageProtectionMessage } from "@/domain/workspace/status-message";
import { readLocalModelReadiness } from "@/domain/resume-generation/local-model-configuration-commands";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const readiness = await readLocalModelReadiness();
  const protection = storageProtectionMessage();
  const dataStorageState = await listDataStorage().catch(() => undefined);

  return (
    <ApplicationShell active="Settings">
      <div className="workspace-shell space-y-8">
        <LocalModelSettings ready={readiness.ready} />
        {dataStorageState ? (
          <div id="data-storage" className="mt-8">
            <DataStorage
              view={dataStorageState}
              protectionSummary={protection.summary}
              protectionDetail={protection.detail}
            />
          </div>
        ) : null}
      </div>
    </ApplicationShell>
  );
}
