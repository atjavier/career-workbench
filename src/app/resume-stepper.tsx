"use client";

import { useState } from "react";

const steps = [
  ["draft-contact", "Your details"],
  ["draft-experience", "Experience"],
  ["draft-projects", "Projects"],
  ["draft-education", "Education"],
  ["draft-skills", "Skills"],
  ["resume-warnings", "Review"],
] as const;

export function ResumeStepper() {
  const [currentStep, setCurrentStep] = useState(0);
  return <section className="resume-stepper" aria-labelledby="resume-steps-heading"><h2 id="resume-steps-heading">Guided resume steps</h2><ol>{steps.map(([id, label], index) => <li key={id}><a href={`#${id}`} aria-current={currentStep === index ? "step" : undefined} onClick={() => setCurrentStep(index)}>{index + 1}. {label}</a></li>)}</ol><p>Use each step to move through the same editable draft in order. Saving never changes the original PDF source.</p></section>;
}
