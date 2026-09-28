"use client";

import { SegmentedTabs, type TabItem } from "@/app/segmented-tabs";

export type JobsView = "all" | "applied";

interface OpportunitySubnavProps {
  currentView: JobsView;
  onViewChange: (view: JobsView) => void;
  allCount?: number;
}

export function OpportunitySubnav({
  currentView,
  onViewChange,
  allCount,
}: OpportunitySubnavProps) {
  const tabs: Array<TabItem<JobsView>> = [
    {
      id: "all",
      label: "All opportunities",
      count: allCount,
      tabId: "all-opportunities-tab",
      ariaControls: "jobs-results-panel",
    },
    {
      id: "applied",
      label: "Applied",
      tabId: "applied-opportunities-tab",
      ariaControls: "jobs-results-panel",
    },
  ];

  return (
    <SegmentedTabs<JobsView>
      tabs={tabs}
      activeTab={currentView}
      onChange={onViewChange}
      ariaLabel="Jobs views"
      idPrefix="jobs-view"
      className="jobs-tabs"
    />
  );
}
