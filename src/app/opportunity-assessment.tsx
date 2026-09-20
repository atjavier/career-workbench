"use client";

import { useActionState } from "react";

import {
  opportunityAssessmentAction,
  type OpportunityAssessmentActionState,
} from "@/app/actions";
import type { OpportunityAssessmentView } from "@/domain/fit/ai-opportunity-assessment";
import type { FitFactor } from "@/domain/fit/fit-assessment";

const initial: OpportunityAssessmentActionState = {
  status: "idle",
  summary: "",
};
export function OpportunityAssessment({
  opportunityId,
  materials,
  initialAssessment,
  latestDecisionId,
  deterministicFit,
}: {
  opportunityId: string;
  materials: Array<{ id: string; label: string }>;
  initialAssessment?: OpportunityAssessmentView;
  latestDecisionId?: string;
  deterministicFit?: {
    label: "Strong" | "Potential" | "Stretch";
    confidence: "high" | "medium" | "low";
    calculatedAt: string;
    factors: FitFactor[];
  };
}) {
  const [state, action, pending] = useActionState(
    opportunityAssessmentAction,
    initialAssessment ? { ...initial, assessment: initialAssessment } : initial,
  );
  const assessment = state.assessment ?? initialAssessment;
  return (
    <details className="opportunity-assessment">
      <summary>Fit explanation</summary>
      <p>
        Use a deterministic local fit label or optional local-AI decision
        support. Neither predicts hiring, interviews, or offers.
      </p>
      <form
        action={action}
        aria-describedby={`assessment-status-${opportunityId}`}
      >
        <input
          type="hidden"
          name="opportunityAssessmentCommand"
          value="deterministic-fit"
        />
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <button className="secondary-action" type="submit" disabled={pending}>
          {pending ? "Calculatingâ€¦" : "Calculate deterministic fit"}
        </button>
      </form>
      {deterministicFit ? (
        <section aria-label="Deterministic fit assessment">
          <h3>{deterministicFit.label} fit</h3>
          <p>
            Confidence: {deterministicFit.confidence}. Calculated from captured
            requirements, approved evidence, and saved preferences.
          </p>
          <ul>
            {deterministicFit.factors.map((factor) => (
              <li key={factor.factor}>
                <strong>{factor.factor}</strong>: {factor.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {materials.length ? (
        <form
          action={action}
          aria-describedby={`assessment-status-${opportunityId}`}
        >
          <input
            type="hidden"
            name="opportunityAssessmentCommand"
            value="assess"
          />
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <fieldset>
            <legend>Approved evidence to share with local AI</legend>
            {materials.map((material) => (
              <label key={material.id}>
                <input
                  type="checkbox"
                  name="evidenceId"
                  value={material.id}
                  defaultChecked
                />{" "}
                {material.label}
              </label>
            ))}
          </fieldset>
          <label>
            <input type="checkbox" name="consent" value="yes" /> I agree that LM
            Studio on this device may read the selected evidence, my saved
            profile summary, and this copied opportunity description for this
            one fit assessment.
          </label>
          <button className="secondary-action" type="submit" disabled={pending}>
            {pending ? "Assessing fit…" : "Assess fit"}
          </button>
        </form>
      ) : (
        <p className="status status-error" role="status">
          Fit assessment needs at least one approved Experience or Projects
          item.
        </p>
      )}
      {state.status !== "idle" ? (
        <p
          id={`assessment-status-${opportunityId}`}
          className={`status status-${state.status === "error" ? "error" : "success"}`}
          role="status"
        >
          {state.summary}
          {state.safeNextAction ? (
            <>
              {" "}
              <strong>Safe next action:</strong> {state.safeNextAction}
            </>
          ) : null}
        </p>
      ) : null}
      {assessment ? (
        <section aria-label="Local AI fit explanation">
          <h3>AI-grounded fit explanation</h3>
          <p>This is local AI decision support, not a hiring prediction.</p>
          <h4>Strengths</h4>
          {assessment.strengths.length ? (
            <ul>
              {assessment.strengths.map((item, index) => (
                <li key={`strength-${index}`}>
                  <p>{item.text}</p>
                  <p>
                    <strong>Approved evidence revision</strong>:{" "}
                    {item.evidence.join("; ")}
                  </p>
                  <p>
                    <strong>Captured posting excerpt</strong>: {item.excerpt}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No strengths were returned.</p>
          )}
          <h4>Gaps and uncertainty</h4>
          {assessment.gaps.length ? (
            <ul>
              {assessment.gaps.map((item, index) => (
                <li key={`gap-${index}`}>
                  <p>{item.text}</p>
                  <p>
                    <strong>Captured posting excerpt</strong>: {item.excerpt}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No gaps were returned.</p>
          )}
          <h4>Unknowns</h4>
          <ul>
            {assessment.unknowns.map((item, index) => (
              <li key={`unknown-${index}`}>{item}</li>
            ))}
          </ul>
          <h4>Safety context</h4>
          {assessment.disclosures.length ? (
            <ul>
              {assessment.disclosures.map((item, index) => (
                <li key={`disclosure-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>
              No explicit Unknown, stale, seniority, location, or work-style
              disclosure applies.
            </p>
          )}
          <Decision
            opportunityId={opportunityId}
            assessmentId={assessment.id}
            latestDecisionId={latestDecisionId}
          />
        </section>
      ) : null}
    </details>
  );
}
function Decision({
  opportunityId,
  assessmentId,
  latestDecisionId,
}: {
  opportunityId: string;
  assessmentId: string;
  latestDecisionId?: string;
}) {
  const [state, action, pending] = useActionState(
    opportunityAssessmentAction,
    initial,
  );
  const expectedDecisionId = state.decisionId ?? latestDecisionId ?? "";
  return (
    <form action={action}>
      <h4>My decision</h4>
      <input
        type="hidden"
        name="opportunityAssessmentCommand"
        value="decision"
      />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input
        type="hidden"
        name="expectedDecisionId"
        value={expectedDecisionId}
      />
      <label>
        <input type="checkbox" name="pursue" value="yes" /> I want to pursue
        this opportunity
      </label>
      <label>
        Priority{" "}
        <select name="priority" defaultValue="normal">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <button className="secondary-action" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save personal decision"}
      </button>
      {state.status !== "idle" ? (
        <p
          className={`status status-${state.status === "error" ? "error" : "success"}`}
          role="status"
        >
          {state.summary}
          {state.safeNextAction ? (
            <>
              {" "}
              <strong>Safe next action:</strong> {state.safeNextAction}
            </>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
