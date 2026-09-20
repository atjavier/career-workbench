import Link from "next/link";

export function ApplicationsWorkspace() {
  return (
    <div className="workspace-shell applications-workspace">
      <header className="applications-header">
        <p className="eyebrow">Career progress</p>
        <h1>Applications</h1>
        <p>
          Keep the captured opportunities you choose to pursue, their progress,
          and your next steps together in one calm workspace.
        </p>
      </header>

      <section
        aria-labelledby="applications-status"
        className="applications-status panel"
      >
        <h2 id="applications-status">Your tracking workspace</h2>
        <p>
          Local tracking will remain available without a Google Sheets
          connection.
        </p>
        <p>
          Google Sheets is not connected yet, and connecting it will always be
          optional. You can open it from the main navigation when you are ready.
        </p>
      </section>

      <section
        aria-labelledby="applications-list"
        className="applications-list"
      >
        <div className="applications-list-heading">
          <div>
            <p className="eyebrow">Applied captured opportunities</p>
            <h2 id="applications-list">Your applications</h2>
          </div>
          <p className="applications-list-summary">
            Captured opportunities you decide to track will appear here.
          </p>
        </div>

        <div className="applications-empty-state">
          <h3>No applications to track yet</h3>
          <p>
            Start in Jobs, choose a captured opportunity you want to pursue, and
            it will become part of your tracking workspace when application
            tracking is available.
          </p>
          <Link href="/">Browse Jobs</Link>
        </div>

        <section
          aria-labelledby="application-details-next"
          className="applications-details-next panel"
        >
          <h3 id="application-details-next">What you will see here</h3>
          <p>
            As you track captured opportunities, this workspace will keep the
            useful details together without making you reconstruct progress from
            memory.
          </p>
          <dl className="applications-future-fields">
            <div>
              <dt>Role and company</dt>
              <dd>The opportunity you chose to pursue.</dd>
            </div>
            <div>
              <dt>Stage and applied date</dt>
              <dd>Your own progress and when you applied.</dd>
            </div>
            <div>
              <dt>Next follow-up and materials</dt>
              <dd>The next step and the resume materials you used.</dd>
            </div>
            <div>
              <dt>Interview history</dt>
              <dd>
                Ordered rounds, dates, statuses, outcomes, notes, and next
                actions.
              </dd>
            </div>
          </dl>
        </section>
      </section>
    </div>
  );
}
