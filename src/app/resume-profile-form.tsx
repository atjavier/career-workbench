"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  saveCandidateProfileAction,
  type CandidateProfileActionState,
} from "@/app/actions";
import type { CandidateProfileValues } from "@/persistence/candidate-profile-repository";

type Props = {
  profileId?: string;
  expectedStateRevisionNumber: number;
  values?: CandidateProfileValues;
};
type FormValues = Record<keyof CandidateProfileValues, string>;

function valuesFromProfile(values?: CandidateProfileValues): FormValues {
  return {
    firstName: values?.firstName ?? "",
    middleName: values?.middleName ?? "",
    lastName: values?.lastName ?? "",
    email: values?.email ?? "",
    phone: values?.phone ?? "",
    school: values?.school ?? "",
    program: values?.program ?? "",
    graduationYear: values?.graduationYear?.toString() ?? "",
    gwa: values?.gwa ?? "",
    latinHonors: values?.latinHonors ?? "",
    linkedInUrl: values?.linkedInUrl ?? "",
    githubUrl: values?.githubUrl ?? "",
  };
}

const fieldMeta: Array<{
  name: keyof FormValues;
  label: string;
  type?: "email" | "tel" | "url" | "number";
  required?: boolean;
  maxLength: number;
}> = [
  { name: "firstName", label: "First name", required: true, maxLength: 120 },
  { name: "middleName", label: "Middle name (optional)", maxLength: 120 },
  { name: "lastName", label: "Last name", required: true, maxLength: 120 },
  {
    name: "email",
    label: "Email",
    type: "email",
    required: true,
    maxLength: 254,
  },
  {
    name: "phone",
    label: "Phone number",
    type: "tel",
    required: true,
    maxLength: 40,
  },
  { name: "school", label: "School", required: true, maxLength: 240 },
  {
    name: "program",
    label: "Degree or program",
    required: true,
    maxLength: 240,
  },
  {
    name: "graduationYear",
    label: "Expected or graduation year",
    type: "number",
    required: true,
    maxLength: 4,
  },
  { name: "gwa", label: "GWA (optional)", maxLength: 20 },
  { name: "latinHonors", label: "Latin honors (optional)", maxLength: 120 },
  {
    name: "linkedInUrl",
    label: "LinkedIn URL (optional)",
    type: "url",
    maxLength: 2048,
  },
  {
    name: "githubUrl",
    label: "GitHub URL (optional)",
    type: "url",
    maxLength: 2048,
  },
];

const fieldGroups = [
  { category: "Personal", fields: fieldMeta.slice(0, 3) },
  {
    category: "Contact",
    fields: fieldMeta.slice(3, 5).concat(fieldMeta.slice(10, 12)),
  },
  { category: "Education", fields: fieldMeta.slice(5, 10) },
];

export function ResumeProfileForm({
  profileId,
  expectedStateRevisionNumber,
  values,
}: Props) {
  const [formValues, setFormValues] = useState<FormValues>(() =>
    valuesFromProfile(values),
  );
  const initialState: CandidateProfileActionState = {
    status: "idle",
    summary: values ? "Details saved." : "Save details to generate.",
  };
  const [state, action, pending] = useActionState(
    saveCandidateProfileAction,
    initialState,
  );
  const errorSummary = useRef<HTMLDivElement>(null);
  const describedBy = (name: keyof FormValues) =>
    state.fieldErrors?.[name] ? `profile-${name}-error` : undefined;

  useEffect(() => {
    if (state.status === "error") errorSummary.current?.focus();
  }, [state.status]);

  return (
    <section
      className="resume-profile-card"
      aria-labelledby="profile-details-heading"
    >
      <div className="resume-pane-head">
        <div>
          <p className="eyebrow">Profile</p>
          <h2 id="profile-details-heading">Profile details</h2>
          <p>Save the details that belong on your resume.</p>
        </div>
      </div>
      <form action={action} noValidate>
        <input type="hidden" name="profileId" value={profileId ?? ""} />
        <input
          type="hidden"
          name="expectedStateRevisionNumber"
          value={expectedStateRevisionNumber}
        />
        {state.status === "error" ? (
          <div
            className="resume-profile-error-summary"
            ref={errorSummary}
            tabIndex={-1}
            role="alert"
          >
            <strong>Check your profile details.</strong>
            <p>{state.summary}</p>
            {state.safeNextAction ? <p>{state.safeNextAction}</p> : null}
          </div>
        ) : null}
        <div className="resume-profile-groups">
          {fieldGroups.map((group) => (
            <section
              className="resume-profile-group"
              key={group.category}
              aria-labelledby={`profile-${group.category.toLowerCase()}-heading`}
            >
              <div className="resume-profile-category">
                <p className="eyebrow">Category</p>
                <h3 id={`profile-${group.category.toLowerCase()}-heading`}>
                  {group.category}
                </h3>
              </div>
              <div className="resume-profile-fields">
                {group.fields.map((field) => {
                  const error = state.fieldErrors?.[field.name];
                  const id = `profile-${field.name}`;
                  return (
                    <div className="resume-profile-field" key={field.name}>
                      <label htmlFor={id}>{field.label}</label>
                      <input
                        id={id}
                        name={field.name}
                        type={field.type ?? "text"}
                        inputMode={
                          field.name === "graduationYear"
                            ? "numeric"
                            : undefined
                        }
                        value={formValues[field.name]}
                        maxLength={field.maxLength}
                        required={field.required}
                        aria-invalid={Boolean(error)}
                        aria-describedby={describedBy(field.name)}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                      {error ? (
                        <p
                          id={`profile-${field.name}-error`}
                          className="field-error"
                        >
                          {error}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="resume-profile-save">
          <button
            className="affirmative-action"
            type="submit"
            disabled={pending}
          >
            {pending ? "Saving details…" : "Save details"}
          </button>
          <p role="status" aria-live="polite">
            {pending ? "Saving details locally…" : state.summary}
          </p>
        </div>
      </form>
    </section>
  );
}
