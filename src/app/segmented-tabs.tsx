"use client";

import type { ReactNode } from "react";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
  ariaControls?: string;
};

export type SegmentedTabsProps<T extends string = string> = {
  tabs: Array<TabItem<T>>;
  activeTab: T;
  onChange: (tabId: T) => void;
  ariaLabel?: string;
  className?: string;
  idPrefix?: string;
};

export function SegmentedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel = "Filter tabs",
  className = "",
  idPrefix = "tab",
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={`modular-segmented-tabs experience-project-tabs ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`${idPrefix}-${tab.id}`}
            type="button"
            role="tab"
            className={`experience-type-tab ${isSelected ? "is-selected" : ""}`}
            aria-selected={isSelected}
            aria-controls={tab.ariaControls}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon ? <span className="tab-icon">{tab.icon}</span> : null}
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span className="tab-badge-count">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
