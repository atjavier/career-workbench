import { ApplicationShell } from "@/app/application-shell";
import { GoogleSheetsWorkspace } from "@/app/google-sheets-workspace";

export const dynamic = "force-dynamic";

export default function GoogleSheetsPage() {
  return (
    <ApplicationShell active="Google Sheets">
      <GoogleSheetsWorkspace />
    </ApplicationShell>
  );
}
