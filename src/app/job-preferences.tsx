"use client";

import { useActionState, useState } from "react";

import { jobPreferencesAction, type WorkspaceActionState } from "@/app/actions";
import type { Country, JobPreferences, JobPreferencesState, RoleIntent, WorkStyle } from "@/domain/discovery/job-preferences";

const initial: WorkspaceActionState = { status: "idle", summary: "Set local eligibility preferences. This form does not enable sources or retrieve jobs." };
const roles: Array<{ value: RoleIntent; label: string }> = [
  { value: "fresh-graduate", label: "Fresh graduate" }, { value: "junior", label: "Junior" }, { value: "associate", label: "Associate" }, { value: "cadetship", label: "Cadetship" }, { value: "paid-training", label: "Paid training" },
];
const countries: Array<{ value: Country; label: string }> = [{ value: "PH", label: "Philippines" }, { value: "SG", label: "Singapore" }, { value: "AU", label: "Australia" }, { value: "CA", label: "Canada" }, { value: "GB", label: "United Kingdom" }, { value: "JP", label: "Japan" }, { value: "US", label: "United States" }];
const workStyles: Array<{ value: WorkStyle; label: string }> = [{ value: "remote", label: "Remote" }, { value: "hybrid", label: "Hybrid" }, { value: "onsite", label: "Onsite" }];

export function JobPreferences({ view, error }: { view: JobPreferencesState; error?: { summary: string; safeNextAction: string } }) {
  const [state, action, pending] = useActionState(jobPreferencesAction, initial);
  const [values, setValues] = useState<JobPreferences>(view.values);
  const isError = state.status === "error" || Boolean(error);
  const describedBy = isError ? "job-preferences-status" : undefined;
  const toggleRole = (role: RoleIntent, checked: boolean) => setValues((current) => ({ ...current, roleIntents: checked ? [...current.roleIntents, role] : current.roleIntents.filter((value) => value !== role) }));
  const updateWorkStyle = (index: number, value: WorkStyle) => setValues((current) => ({ ...current, workStyleOrder: current.workStyleOrder.map((item, itemIndex) => itemIndex === index ? value : item) as WorkStyle[] }));

  return <section id="search-preferences" aria-labelledby="search-preferences-heading" className="panel"><h2 id="search-preferences-heading">Search Preferences</h2><p>These local preferences prioritize roles for later manual discovery. They do not enable a source, change source policy, or retrieve jobs.</p>
    <form action={action}>
      <input type="hidden" name="expectedRevisionId" value={view.revisionId ?? ""} />
      <fieldset><legend>Role intent</legend>{roles.map((role) => <label key={role.value}><input type="checkbox" name="roleIntent" value={role.value} checked={values.roleIntents.includes(role.value)} onChange={(event) => toggleRole(role.value, event.target.checked)} aria-invalid={isError} aria-describedby={describedBy} /> {role.label}</label>)}</fieldset>
      <label htmlFor="preference-country">Country</label><select id="preference-country" name="country" value={values.country} onChange={(event) => setValues((current) => ({ ...current, country: event.target.value as Country }))} aria-invalid={isError} aria-describedby={describedBy}>{countries.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}</select>
      <fieldset><legend>Work-style priority</legend>{[0, 1, 2].map((index) => <label key={index} htmlFor={`work-style-${index}`}>{["First", "Second", "Third"][index]} priority<select id={`work-style-${index}`} name={["workStyleFirst", "workStyleSecond", "workStyleThird"][index]} value={values.workStyleOrder[index]} onChange={(event) => updateWorkStyle(index, event.target.value as WorkStyle)} aria-invalid={isError} aria-describedby={describedBy}>{workStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}</select></label>)}</fieldset>
      <label><input type="checkbox" name="preferNcrHybridOnsite" value="yes" checked={values.preferNcrHybridOnsite} onChange={(event) => setValues((current) => ({ ...current, preferNcrHybridOnsite: event.target.checked }))} aria-invalid={isError} aria-describedby={describedBy} /> Prioritize NCR for Hybrid and Onsite</label>
      <button type="submit" disabled={pending}>Save Search Preferences</button>
    </form>
    <p id="job-preferences-status" role="status" aria-live="polite" className={isError ? "status status-error" : "status"}>{error ? error.summary : state.summary}{error?.safeNextAction || state.safeNextAction ? <> <strong>Safe next action:</strong> {error?.safeNextAction ?? state.safeNextAction}</> : null}</p>
    <p>No source is enabled or refreshed here. Configure permitted sources before a future manual refresh.</p>
  </section>;
}
