"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  chooseLocalEvidenceFolderAction,
  resumeOnboardingAction,
  type FolderPickerActionState,
  type WorkspaceActionState,
} from "@/app/actions";

const initial: WorkspaceActionState = {
  status: "idle",
  summary: "",
};

const pickerInitial: FolderPickerActionState = {
  status: "idle",
  summary: "Choose a local folder.",
};

type ProjectItem = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  folderPath?: string;
  folderName?: string;
};

type ExperienceItem = {
  id: number;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  folderPath?: string;
  folderName?: string;
};

function FolderSelectionTile({
  label,
  itemName,
  folderName,
  folderPath,
  onSelected,
  error,
}: {
  label: string;
  itemName: string;
  folderName?: string;
  folderPath?: string;
  onSelected: (result: FolderPickerActionState) => void;
  error?: string;
}) {
  const [state, action, pending] = useActionState(
    chooseLocalEvidenceFolderAction,
    pickerInitial,
  );

  const onSelectedRef = useRef(onSelected);
  onSelectedRef.current = onSelected;
  const lastStateRef = useRef<FolderPickerActionState>(pickerInitial);

  useEffect(() => {
    if (state.folderPath && state !== lastStateRef.current) {
      lastStateRef.current = state;
      onSelectedRef.current(state);
    }
  }, [state]);

  const accessibleName = folderPath
    ? `Change folder for ${itemName || label}`
    : `Choose local folder for ${itemName || label}`;

  return (
    <div className="local-folder-picker folder-selection-tile">
      <div
        className="local-folder-input"
        aria-label={`Local folder selector for ${itemName || label}`}
      >
        <span className="folder-name-display">
          {folderName ?? "No folder selected"}
        </span>
        <button
          type="button"
          aria-label={accessibleName}
          onClick={() => startTransition(() => action())}
          disabled={pending}
        >
          {pending
            ? "Opening..."
            : folderPath
              ? "Change folder"
              : "Choose folder"}
        </button>
      </div>
      <p role="status" className="folder-status-note">
        {folderName
          ? `${folderName} selected for bounded local inspection. Source files remain unchanged and no transfer begins merely by choosing it.`
          : error ??
            (state.status === "error"
              ? state.summary
              : "Choose a local folder from this computer.")}
      </p>
    </div>
  );
}

export function ResumeOnboarding({ localAiReady }: { localAiReady: boolean }) {
  const [state, action, pending] = useActionState(
    resumeOnboardingAction,
    initial,
  );
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [selectionMessage, setSelectionMessage] = useState<string>();
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>();

  const nextId = () => {
    const existingIds = [
      ...projects.map((p) => p.id),
      ...experiences.map((e) => e.id),
    ];
    return existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  };

  const addProject = () => {
    if (projects.length + experiences.length >= 12) {
      setSelectionMessage("You can add up to 12 total Projects and Experiences.");
      return;
    }
    setSelectionMessage(undefined);
    setProjects((items) => [
      ...items,
      { id: nextId(), name: "", startDate: "", endDate: "" },
    ]);
  };

  const removeProject = (id: number) => {
    setProjects((items) => items.filter((item) => item.id !== id));
  };

  const updateProject = (id: number, value: Partial<ProjectItem>) => {
    setProjects((items) =>
      items.map((item) => (item.id === id ? { ...item, ...value } : item)),
    );
  };

  const recordProjectFolder = useCallback(
    (id: number, result: FolderPickerActionState) => {
      if (!result.folderPath) return;
      setSelectionMessage(undefined);
      setProjects((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                folderPath: result.folderPath,
                folderName: result.folderName,
              }
            : item,
        ),
      );
    },
    [],
  );

  const addExperience = () => {
    if (projects.length + experiences.length >= 12) {
      setSelectionMessage("You can add up to 12 total Projects and Experiences.");
      return;
    }
    setSelectionMessage(undefined);
    setExperiences((items) => [
      ...items,
      {
        id: nextId(),
        company: "",
        role: "",
        startDate: "",
        endDate: "",
        currentlyWorking: false,
      },
    ]);
  };

  const removeExperience = (id: number) => {
    setExperiences((items) => items.filter((item) => item.id !== id));
  };

  const updateExperience = (id: number, value: Partial<ExperienceItem>) => {
    setExperiences((items) =>
      items.map((item) => (item.id === id ? { ...item, ...value } : item)),
    );
  };

  const handleCurrentRoleToggle = (id: number, checked: boolean) => {
    setExperiences((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              currentlyWorking: checked,
              endDate: checked ? "" : item.endDate,
            }
          : item,
      ),
    );
    const target = experiences.find((e) => e.id === id);
    const label = target?.role || target?.company || "Experience";
    setLiveAnnouncement(
      checked
        ? `${label} set to currently working. End date cleared and marked as Present.`
        : `${label} end date is now editable.`,
    );
  };

  const recordExperienceFolder = useCallback(
    (id: number, result: FolderPickerActionState) => {
      if (!result.folderPath) return;
      setSelectionMessage(undefined);
      setExperiences((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                folderPath: result.folderPath,
                folderName: result.folderName,
              }
            : item,
        ),
      );
    },
    [],
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const allItems = [
      ...projects.map((p) => ({ ...p, category: "project" as const })),
      ...experiences.map((e) => ({
        ...e,
        name: e.company,
        category: "experience" as const,
      })),
    ];

    if (allItems.length === 0) {
      setSelectionMessage(
        "Add at least one Project or Experience before creating this resume.",
      );
      return;
    }

    if (allItems.some((item) => !item.folderPath)) {
      setSelectionMessage(
        "Choose a local folder for every Project or Experience before creating this resume.",
      );
      return;
    }

    const data = new FormData(event.currentTarget);
    data.set("workCount", String(allItems.length));

    allItems.forEach((item, index) => {
      data.set(`category-${index}`, item.category);
      data.set(`sourceDirectory-${index}`, item.folderPath!);
      data.set(
        `itemName-${index}`,
        item.category === "project"
          ? (item as ProjectItem).name
          : (item as ExperienceItem).company,
      );
      data.set(`startDate-${index}`, item.startDate);
      data.set(
        `endDate-${index}`,
        item.category === "experience" && (item as ExperienceItem).currentlyWorking
          ? "Present"
          : item.endDate,
      );
      if (item.category === "experience") {
        data.set(`role-${index}`, (item as ExperienceItem).role);
        data.set(
          `currentlyWorking-${index}`,
          (item as ExperienceItem).currentlyWorking ? "yes" : "no",
        );
      }
    });
    data.set("localModelDisclosure", "yes");

    startTransition(() => action(data));
  };

  useEffect(() => {
    if (state.status === "success" && state.workspaceId)
      router.replace("/resume/interview");
  }, [router, state.status, state.workspaceId]);

  return (
    <div className="resume-builder-layout">
      <section
        className="resume-onboarding panel resume-builder-main"
        aria-labelledby="resume-onboarding-heading"
      >
        <div className="builder-header-block">
          <p className="eyebrow">Build Your Resume</p>
          <h2 id="resume-onboarding-heading">
            Your basic information and local work folders
          </h2>
          <p className="builder-subtitle">
            Complete your profile to generate a tailored, ATS-friendly resume.
            Add every Project and Experience you want to start with. The local
            evidence agent reads each chosen folder directly within its allowlist
            and safety limits, then Coach Resume will ask about important context
            the folders cannot establish. Folder paths and raw files are not
            retained.
          </p>
        </div>

        <div
          className="resume-onboarding-progress stage-goals-grid"
          aria-label="Resume milestones and goals"
        >
          <div className="stage-goal-card stage-active" aria-current="step">
            <div className="stage-goal-header">
              <span className="stage-number-pill">Stage 1</span>
              <span className="stage-status-badge stage-badge-active">In Progress</span>
            </div>
            <h3 className="stage-goal-title">Profile &amp; Evidence Intake</h3>
            <p className="stage-goal-desc">
              Input verified details and select local work folders for bounded inspection.
            </p>
            <div className="stage-goal-meta">
              <span className="stage-meta-item">Goal: Extract source-backed technical facts</span>
            </div>
          </div>

          <div className="stage-goal-card stage-upcoming">
            <div className="stage-goal-header">
              <span className="stage-number-pill">Stage 2</span>
              <span className="stage-status-badge stage-badge-upcoming">Next Up</span>
            </div>
            <h3 className="stage-goal-title">AI Clarification Interview</h3>
            <p className="stage-goal-desc">
              Your local Coach clarifies architectural decisions, tradeoffs, and outcomes.
            </p>
            <div className="stage-goal-meta">
              <span className="stage-meta-item">Goal: Turn facts into validated achievements</span>
            </div>
          </div>

          <div className="stage-goal-card stage-upcoming">
            <div className="stage-goal-header">
              <span className="stage-number-pill">Stage 3</span>
              <span className="stage-status-badge stage-badge-upcoming">Final Milestone</span>
            </div>
            <h3 className="stage-goal-title">Resume Generation &amp; Review</h3>
            <p className="stage-goal-desc">
              Synthesize ATS-optimized resumes with side-by-side evidence inspection.
            </p>
            <div className="stage-goal-meta">
              <span className="stage-meta-item">Goal: Export verifiable, tailored resumes</span>
            </div>
          </div>
        </div>

        {!localAiReady ? (
          <div className="status status-warning ai-setup-banner">
            <p>
              Set up local AI before submitting folders.{" "}
              <Link className="resume-coach-setup-link" href="/settings">
                Set up local AI
              </Link>
            </p>
          </div>
        ) : null}

        <form onSubmit={submit} className="builder-form-grid">
          <div className="resume-name-card card-surface">
            <div className="section-card-header">
              <h3 className="section-card-title">
                <span className="icon-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                Resume Name &amp; Target Role
              </h3>
              <span className="badge-counter">Primary Identifier</span>
            </div>
            <p className="collection-hint">
              Give your resume a clear, descriptive title to easily identify and compare versions later.
            </p>
            <div className="resume-onboarding-fields">
              <label htmlFor="resume-name">
                Resume Name
                <input
                  id="resume-name"
                  name="resumeName"
                  placeholder="e.g. Senior Full-Stack Engineer — Q3 2026"
                  required
                  maxLength={120}
                  className="input-base resume-name-input"
                />
              </label>
            </div>
          </div>

          <div className="personal-education-grid">
            <div className="card-surface personal-details-card">
              <h3 className="section-card-title">
                <span className="icon-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                Personal Details &amp; Contacts
              </h3>
              <div className="resume-onboarding-fields">
                <label>
                  First name
                  <input name="firstName" required maxLength={120} className="input-base" placeholder="Jane" />
                </label>
                <label>
                  Middle name (optional)
                  <input name="middleName" maxLength={120} className="input-base" />
                </label>
                <label>
                  Last name
                  <input name="lastName" required maxLength={120} className="input-base" placeholder="Doe" />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required maxLength={254} className="input-base" placeholder="jane.doe@example.com" />
                </label>
                <label>
                  Phone
                  <input name="phone" required maxLength={40} className="input-base" placeholder="+1 (555) 000-0000" />
                </label>
                <label>
                  LinkedIn URL (optional)
                  <input name="linkedInUrl" type="url" maxLength={2048} className="input-base" placeholder="https://linkedin.com/in/username" />
                </label>
                <label>
                  GitHub URL (optional)
                  <input name="githubUrl" type="url" maxLength={2048} className="input-base" placeholder="https://github.com/username" />
                </label>
              </div>
            </div>

            <div className="card-surface education-card">
              <h3 className="section-card-title">
                <span className="icon-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </span>
                Education &amp; Academic Background
              </h3>
              <div className="resume-onboarding-fields">
                <label>
                  School
                  <input name="school" required maxLength={240} className="input-base" placeholder="University of the Philippines" />
                </label>
                <label>
                  Degree or program
                  <input name="program" required maxLength={240} className="input-base" placeholder="BS Computer Science" />
                </label>
                <label>
                  Expected or graduation year
                  <input
                    name="graduationYear"
                    inputMode="numeric"
                    required
                    maxLength={4}
                    className="input-base"
                    placeholder="2026"
                  />
                </label>
                <label>
                  GWA (optional)
                  <input name="gwa" maxLength={20} className="input-base" placeholder="1.25" />
                </label>
                <label>
                  Latin honors (optional)
                  <input name="latinHonors" maxLength={120} className="input-base" placeholder="Magna Cum Laude" />
                </label>
              </div>
            </div>
          </div>

          <div className="work-collections-header">
            <h3 className="section-card-title">
              <span className="icon-badge" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="7" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </span>
              Projects and Experiences
            </h3>
            <p className="collection-hint">
              Add every Project and Experience you want to start with.
            </p>
          </div>

          <fieldset className="onboarding-work onboarding-projects card-surface">
            <legend>Projects</legend>
            <div className="section-card-header">
              <span className="section-card-title">
                <span className="icon-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  </svg>
                </span>
                Projects
              </span>
              <span className="badge-counter">{projects.length} project{projects.length === 1 ? "" : "s"}</span>
            </div>
            <p className="collection-hint">
              Add projects you have created or contributed to.
            </p>
            {projects.length === 0 ? (
              <p className="collection-empty-note">
                No projects added yet. Click &ldquo;Add project&rdquo; below to add your first project.
              </p>
            ) : null}
            {projects.map((item, index) => (
              <section
                key={item.id}
                className="onboarding-work-item project-entry-card"
                aria-label={`Project: ${item.name || "Untitled"}`}
              >
                <div>
                  <label htmlFor={`project-name-${item.id}`}>Project name</label>
                  <input
                    id={`project-name-${item.id}`}
                    name={`projectName-${index}`}
                    value={item.name}
                    onChange={(e) =>
                      updateProject(item.id, { name: e.target.value })
                    }
                    placeholder="e.g. Distributed Job Discovery System"
                    required
                    maxLength={120}
                    className="input-base"
                  />
                </div>
                <div className="work-date-range">
                  <div>
                    <label htmlFor={`project-start-${item.id}`}>Start date</label>
                    <input
                      id={`project-start-${item.id}`}
                      name={`projectStartDate-${index}`}
                      value={item.startDate}
                      onChange={(e) =>
                        updateProject(item.id, { startDate: e.target.value })
                      }
                      placeholder="YYYY-MM"
                      required
                      maxLength={20}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label htmlFor={`project-end-${item.id}`}>End date</label>
                    <input
                      id={`project-end-${item.id}`}
                      name={`projectEndDate-${index}`}
                      value={item.endDate}
                      onChange={(e) =>
                        updateProject(item.id, { endDate: e.target.value })
                      }
                      placeholder="YYYY-MM"
                      required
                      maxLength={20}
                      className="input-base"
                    />
                  </div>
                </div>
                <div>
                  <span className="field-subheading">Local folder</span>
                  <FolderSelectionTile
                    label="Project folder"
                    itemName={item.name || "project"}
                    folderName={item.folderName}
                    folderPath={item.folderPath}
                    onSelected={(res) => recordProjectFolder(item.id, res)}
                  />
                </div>
                <button
                  type="button"
                  className="secondary-action remove-item-button"
                  onClick={() => removeProject(item.id)}
                >
                  Remove this project
                </button>
              </section>
            ))}
            <button
              type="button"
              className="secondary-action add-project-button"
              onClick={addProject}
            >
              Add project
            </button>
          </fieldset>

          <fieldset className="onboarding-work onboarding-experiences card-surface">
            <legend>Experiences</legend>
            <div className="section-card-header">
              <span className="section-card-title">
                <span className="icon-badge" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="7" rx="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </span>
                Experiences
              </span>
              <span className="badge-counter">{experiences.length} experience{experiences.length === 1 ? "" : "s"}</span>
            </div>
            <p className="collection-hint">
              Add internships, employment, or leadership roles.
            </p>
            {experiences.length === 0 ? (
              <p className="collection-empty-note">
                No experiences added yet. Click &ldquo;Add experience&rdquo; below to add your first role.
              </p>
            ) : null}
            {experiences.map((item, index) => (
              <section
                key={item.id}
                className="onboarding-work-item experience-entry-card"
                aria-label={`Experience: ${item.role ? `${item.role} at ${item.company}` : item.company || "Untitled"}`}
              >
                <div>
                  <label htmlFor={`exp-company-${item.id}`}>
                    Company or organization
                  </label>
                  <input
                    id={`exp-company-${item.id}`}
                    name={`expCompany-${index}`}
                    value={item.company}
                    onChange={(e) =>
                      updateExperience(item.id, { company: e.target.value })
                    }
                    placeholder="e.g. Acme Corp"
                    required
                    maxLength={120}
                    className="input-base"
                  />
                </div>
                <div>
                  <label htmlFor={`exp-role-${item.id}`}>Role</label>
                  <input
                    id={`exp-role-${item.id}`}
                    name={`expRole-${index}`}
                    value={item.role}
                    onChange={(e) =>
                      updateExperience(item.id, { role: e.target.value })
                    }
                    placeholder="e.g. Software Engineering Intern"
                    required
                    maxLength={120}
                    className="input-base"
                  />
                </div>
                <div className="work-date-range">
                  <div>
                    <label htmlFor={`exp-start-${item.id}`}>Start date</label>
                    <input
                      id={`exp-start-${item.id}`}
                      name={`expStartDate-${index}`}
                      value={item.startDate}
                      onChange={(e) =>
                        updateExperience(item.id, { startDate: e.target.value })
                      }
                      placeholder="YYYY-MM"
                      required
                      maxLength={20}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label htmlFor={`exp-end-${item.id}`}>End date</label>
                    <input
                      id={`exp-end-${item.id}`}
                      name={`expEndDate-${index}`}
                      value={item.currentlyWorking ? "" : item.endDate}
                      disabled={item.currentlyWorking}
                      onChange={(e) =>
                        updateExperience(item.id, { endDate: e.target.value })
                      }
                      placeholder={item.currentlyWorking ? "Present" : "YYYY-MM"}
                      required={!item.currentlyWorking}
                      maxLength={20}
                      aria-describedby={`exp-current-desc-${item.id}`}
                      className="input-base"
                    />
                    {item.currentlyWorking ? (
                      <span className="present-badge">Present</span>
                    ) : null}
                  </div>
                </div>
                <div className="current-work-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      id={`exp-current-${item.id}`}
                      checked={item.currentlyWorking}
                      onChange={(e) =>
                        handleCurrentRoleToggle(item.id, e.target.checked)
                      }
                    />{" "}
                    I currently work here
                  </label>
                  <span id={`exp-current-desc-${item.id}`} className="sr-only">
                    {item.currentlyWorking
                      ? "Currently working here. End date is cleared."
                      : "End date is required."}
                  </span>
                </div>
                <div>
                  <span className="field-subheading">Local folder</span>
                  <FolderSelectionTile
                    label="Experience folder"
                    itemName={item.company || item.role || "experience"}
                    folderName={item.folderName}
                    folderPath={item.folderPath}
                    onSelected={(res) => recordExperienceFolder(item.id, res)}
                  />
                </div>
                <button
                  type="button"
                  className="secondary-action remove-item-button"
                  onClick={() => removeExperience(item.id)}
                >
                  Remove this experience
                </button>
              </section>
            ))}
            <button
              type="button"
              className="secondary-action add-experience-button"
              onClick={addExperience}
            >
              Add experience
            </button>
          </fieldset>

          {liveAnnouncement ? (
            <p role="status" className="sr-only">
              {liveAnnouncement}
            </p>
          ) : null}

          <div className="consent-and-submit-block card-surface">
            <input type="hidden" name="localModelDisclosure" value="yes" />
            <div className="submit-card-content">
              <div>
                <h3 className="section-card-title">Ready for AI Analysis</h3>
                <p className="collection-hint">
                  Your profile details and selected local folders will be inspected locally to extract technical evidence and prepare clarification questions for your AI Resume Coach interview.
                </p>
              </div>
              <div className="submit-action-row">
                <button
                  className="affirmative-action btn-primary"
                  type="submit"
                  disabled={pending || !localAiReady}
                >
                  {pending
                    ? "Processing evidence & launching interview..."
                    : "Process local evidence & start AI interview →"}
                </button>
              </div>
            </div>
            {selectionMessage || state.status === "error" ? (
              <p role="status" className="status status-error">
                {selectionMessage ?? state.summary}
              </p>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}


