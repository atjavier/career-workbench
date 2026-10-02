import { ApplicationShell } from "@/components/common/application-shell";
import { GoogleSheetsWorkspace } from "@/components/pro/google-sheets-workspace";

export const dynamic = "force-dynamic";

export default function GoogleSheetsPage() {
  return (
    <ApplicationShell active="Google Sheets">
      <GoogleSheetsWorkspace />
    </ApplicationShell>
  );
}
