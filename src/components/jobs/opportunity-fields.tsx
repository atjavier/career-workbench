import { useId, type ReactNode, type ChangeEvent } from "react";

export function OpportunityField({ name, label, value, multiline = false, rows = 4, disabled, readOnly, error, maxLength, required = true, type = "text", className = "", help, action, onValueChange }: {
  name: string; label: string; value: string; multiline?: boolean; rows?: number;
  disabled?: boolean; readOnly?: boolean; error?: string; maxLength?: number;
  required?: boolean; type?: "text" | "url" | "date"; className?: string;
  help?: string; action?: ReactNode; onValueChange?: (value: string) => void;
}) {
  const id = useId();
  const props = { id, name, ...(onValueChange ? { value, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValueChange(event.target.value) } : { defaultValue: value }), disabled, readOnly, required, maxLength,
    "aria-invalid": error ? true as const : undefined, "aria-describedby": error ? `${id}-error` : help ? `${id}-help` : undefined };
  return <div className={`opportunity-form-field ${className}`.trim()}>
    <label htmlFor={id}>{label}</label>
    {multiline ? <textarea {...props} rows={rows} /> : <input {...props} type={type} />}
    {action}
    {help && <p id={`${id}-help`} className="field-help">{help}</p>}
    {error ? <p id={`${id}-error`} className="field-error">{error}</p> : null}
  </div>;
}

export function OpportunityFormFields({ values, errors, disabled, mode = "edit", group = "all", descriptionCentered = false, onValueChange }: {
  values: Record<string, string>; errors?: Record<string, string>; disabled?: boolean; mode?: "create" | "edit"; group?: "all" | "source" | "details"; descriptionCentered?: boolean; onValueChange?: (name: string, value: string) => void;
}) {
  const create = mode === "create";
  const fields = [
    ...(create ? [
      { name: "postingUrl", label: "Posting URL", max: 2048, wide: true },
      { name: "copiedDescription", label: "Job description", max: 200000, wide: true, multiline: true },
    ] : []),
    { name: "title", label: "Role title", max: 300 },
    { name: "company", label: "Company", max: 300 },
    { name: "location", label: create ? "Location (optional)" : "Location", max: 300, optional: true },
    { name: "workStyle", label: create ? "Work style (optional)" : "Work style", max: 120, optional: true },
    { name: "postedAt", label: create ? "Posted date (optional)" : "Posted date (YYYY-MM-DD or Unknown)", max: 40, optional: true },
    ...(!create ? [
      { name: "postingUrl", label: "Posting URL", max: 2048, wide: true },
      { name: "copiedDescription", label: "Job description", max: 200000, wide: true, multiline: true },
    ] : []),
    ...(descriptionCentered ? [{ name: "refinedDescription", label: "Formatted job description", max: 500000, wide: true, multiline: true, optional: true }] : [{ name: "requirements", label: create ? "Requirements (optional, one per line)" : "Requirements (one per line, up to 20)", max: 20000, wide: true, multiline: true, optional: true }]),
  ];
  return <>{fields.filter(field => group === "all" || (group === "source") === ["postingUrl", "copiedDescription"].includes(field.name)).map(field => <OpportunityField key={field.name} name={field.name} label={field.label}
    value={values[field.name] ?? ""} error={errors?.[field.name]} disabled={disabled}
    required={!create || !field.optional} multiline={field.multiline} rows={["copiedDescription", "refinedDescription"].includes(field.name) ? 14 : 4}
    maxLength={field.max} type={field.name === "postingUrl" ? "url" : create && field.name === "postedAt" ? "date" : "text"}
    onValueChange={onValueChange ? value => onValueChange(field.name, value) : undefined}
    help={create && field.name === "postingUrl" ? "Reference only. This page does not retrieve the posting." : undefined}
    className={field.wide ? "opportunity-form-wide" : ""} />)}</>;
}

export function OpportunityFacts({ opportunity }: { opportunity: { location: string; workStyle: string; postedAt: string } }) {
  return <dl className="job-listing-facts">
    <div><dt>Location</dt><dd>{opportunity.location}</dd></div>
    <div><dt>Work style</dt><dd>{opportunity.workStyle}</dd></div>
    <div><dt>Posted date</dt><dd>{opportunity.postedAt === "Unknown" ? "Unknown" : opportunity.postedAt.slice(0, 10)}</dd></div>
  </dl>;
}
