import Link from "next/link";

const connectionFields = [
  ["Connection", "Not connected"],
  ["Google account", "Not selected"],
  ["Spreadsheet", "Not selected"],
  ["Worksheet", "Not selected"],
  ["Permission", "No Google permission granted"],
  ["Last sync", "No sync has run"],
] as const;

export function GoogleSheetsWorkspace() {
  return <div className="workspace-shell google-sheets-workspace">
    <header className="workspace-header">
      <p className="eyebrow">Google Sheets</p>
      <h1>Your optional application tracker</h1>
      <p>Keep your job search organized here when you are ready. Google Sheets is optional, and the Applications workspace stays on this device whether or not you ever connect a Google Sheet.</p>
    </header>

    <section className="panel sheets-connection-panel" aria-labelledby="sheets-connection-heading">
      <div className="sheets-section-heading">
        <div><p className="status-label">Current connection</p><h2 id="sheets-connection-heading">Working locally</h2></div>
        <p className="sheets-state-label">Not connected</p>
      </div>
      <dl className="sheets-connection-summary">
        {connectionFields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="sheets-local-note">Connecting is optional. You can keep reviewing the Applications workspace while Google Sheets connection is unavailable.</p>
      <Link className="sheets-workspace-link" href="/applications">Open Applications workspace</Link>
    </section>

    <section className="panel sheets-review-panel" aria-labelledby="sheets-review-heading">
      <p className="status-label">Before data is shared</p>
      <h2 id="sheets-review-heading">What you will review before connecting</h2>
      <p>Google Sheets connection is not available yet, and no Google authorization has begun. When it is ready, you will review every detail before choosing whether to continue.</p>
      <dl className="sheets-review-fields">
        <div><dt>Google account</dt><dd>Choose the account you want to use.</dd></div>
        <div><dt>Permission</dt><dd>Review the Sheets-only permission requested for your tracker.</dd></div>
        <div><dt>Tracker destination</dt><dd>Create a user-owned spreadsheet or paste the spreadsheet you want to use, then choose its worksheet.</dd></div>
        <div><dt>Edit access</dt><dd>The app will verify edit access before any tracker update.</dd></div>
        <div><dt>Update behavior</dt><dd>Review what can be created or updated before anything is mirrored.</dd></div>
      </dl>
    </section>

    <section className="panel sheets-categories-panel" aria-labelledby="sheets-categories-heading">
      <h2 id="sheets-categories-heading">What a future tracker can include</h2>
      <ul className="evidence-chip-list" aria-label="Planned tracker categories">
        <li className="evidence-chip">Applications</li>
        <li className="evidence-chip">Material versions</li>
        <li className="evidence-chip">Follow-ups</li>
        <li className="evidence-chip">Interview rounds</li>
      </ul>
      <p>Sensitive notes stay local-only unless you explicitly choose to include them in a future connection review.</p>
    </section>

    <section className="panel sheets-recovery-panel" aria-labelledby="sheets-recovery-heading">
      <p className="status-label">Future recovery</p>
      <h2 id="sheets-recovery-heading">Your local records stay in your control</h2>
      <p>If future access, permission, write, or difference-review work needs attention, the workspace will name the affected record, preserve your local value, and offer the relevant explicit next step: reconnect, retry, or review reconciliation. Nothing is changed automatically.</p>
      <p>That connection and recovery workflow is still being prepared. Until then, keep working locally.</p>
    </section>
  </div>;
}
