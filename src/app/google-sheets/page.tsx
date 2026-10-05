import { ApplicationShell } from "@/components/common/application-shell";
import { GoogleSheetsWorkspace } from "@/components/integrations/google-sheets-workspace";

export const dynamic = "force-dynamic";

export default function GoogleSheetsPage() {
  return (
    <ApplicationShell active="Google Sheets">
      <GoogleSheetsWorkspace />
    </ApplicationShell>
  );
}
