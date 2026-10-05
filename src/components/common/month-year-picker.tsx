"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS = [
  { short: "Jan", full: "January" },
  { short: "Feb", full: "February" },
  { short: "Mar", full: "March" },
  { short: "Apr", full: "April" },
  { short: "May", full: "May" },
  { short: "Jun", full: "June" },
  { short: "Jul", full: "July" },
  { short: "Aug", full: "August" },
  { short: "Sep", full: "September" },
  { short: "Oct", full: "October" },
  { short: "Nov", full: "November" },
  { short: "Dec", full: "December" },
] as const;

export type MonthYearPickerProps = {
  id?: string;
  name?: string;
  value: string; // Expected format: "YYYY-MM" or ""
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  ariaDescribedBy?: string;
  startYear?: number;
  endYear?: number;
  align?: "left" | "right";
};

export function MonthYearPicker({
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Select date",
  className = "",
  ariaDescribedBy,
  startYear = 1970,
  endYear = new Date().getFullYear() + 10,
  align = "left",
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"months" | "years">("months");
  const [yearPageStart, setYearPageStart] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  // Parse current value
  const parseValue = (val: string) => {
    if (!val) return null;
    const parts = val.split("-");
    if (parts.length === 2) {
      const y = parseInt(parts[0]!, 10);
      const m = parseInt(parts[1]!, 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        return { year: y, monthIndex: m - 1 };
      }
    }
    return null;
  };

  const parsed = parseValue(value);
  const [browsingYear, setBrowsingYear] = useState<number>(
    parsed?.year ?? currentYear,
  );

  // Sync browsing year when value changes externally
  useEffect(() => {
    if (parsed) {
      setBrowsingYear(parsed.year);
    }
  }, [value]);

  // Click-outside and keyboard listeners
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setBrowsingYear(parsed?.year ?? currentYear);
      setView("months");
    }
    setIsOpen((prev) => !prev);
  };

  const openYearView = () => {
    setYearPageStart(Math.floor(browsingYear / 12) * 12);
    setView("years");
  };

  const handleSelectYear = (year: number) => {
    setBrowsingYear(year);
    setView("months");
  };

  const handleSelectMonth = (monthIndex: number) => {
    const monthStr = String(monthIndex + 1).padStart(2, "0");
    const formatted = `${browsingYear}-${monthStr}`;
    onChange(formatted);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleThisMonth = () => {
    const monthStr = String(currentMonthIdx + 1).padStart(2, "0");
    onChange(`${currentYear}-${monthStr}`);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Human-friendly display label: e.g. "Mar 2024"
  const displayLabel = parsed
    ? `${MONTHS[parsed.monthIndex]!.short} ${parsed.year}`
    : "";

  return (
    <div className="month-picker-wrap" ref={containerRef}>
      {/* Hidden input for form serialization */}
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value}
        />
      ) : null}

      {/* Accessible trigger button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-required={required}
        aria-describedby={ariaDescribedBy}
        aria-label={
          displayLabel
            ? `Selected date: ${displayLabel}. Click to change month and year`
            : "Choose month and year"
        }
        className={`month-picker-trigger ${className}`}
      >
        <span
          className={
            displayLabel
              ? "month-picker-trigger-val"
              : "month-picker-trigger-placeholder"
          }
        >
          {displayLabel || placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="month-picker-calendar-icon"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Popover */}
      {isOpen ? (
        <div
          className={`month-picker-popover ${align === "right" ? "align-right" : ""}`}
          role="dialog"
          aria-label="Choose month and year"
        >
          {view === "months" ? (
            <>
              <div className="month-picker-header">
                <button
                  type="button"
                  className="month-picker-nav-btn"
                  onClick={() =>
                    setBrowsingYear((y) => Math.max(startYear, y - 1))
                  }
                  disabled={browsingYear <= startYear}
                  aria-label="Previous year"
                  title="Previous year"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="month-picker-year-title"
                  onClick={openYearView}
                  aria-label={`${browsingYear}. Choose a different year`}
                >
                  {browsingYear}
                  <span aria-hidden="true" className="month-picker-year-caret">
                    ▾
                  </span>
                </button>
                <button
                  type="button"
                  className="month-picker-nav-btn"
                  onClick={() =>
                    setBrowsingYear((y) => Math.min(endYear, y + 1))
                  }
                  disabled={browsingYear >= endYear}
                  aria-label="Next year"
                  title="Next year"
                >
                  ›
                </button>
              </div>

              <div
                className="month-picker-grid"
                role="grid"
                aria-label={`Months of ${browsingYear}`}
              >
                {MONTHS.map((month, idx) => {
                  const isSelected =
                    parsed?.year === browsingYear && parsed?.monthIndex === idx;
                  const isCurrent =
                    currentYear === browsingYear && currentMonthIdx === idx;

                  return (
                    <button
                      key={month.short}
                      type="button"
                      onClick={() => handleSelectMonth(idx)}
                      className={`month-picker-month-btn ${
                        isSelected ? "is-selected" : ""
                      } ${isCurrent ? "is-current" : ""}`}
                      aria-label={`${month.full} ${browsingYear}`}
                      aria-pressed={isSelected}
                    >
                      {month.short}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="month-picker-header">
                <button
                  type="button"
                  className="month-picker-nav-btn"
                  onClick={() => setYearPageStart((s) => s - 12)}
                  disabled={yearPageStart <= startYear}
                  aria-label="Earlier years"
                  title="Earlier years"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="month-picker-year-title"
                  onClick={() => setView("months")}
                  aria-label="Back to months"
                >
                  {yearPageStart} – {yearPageStart + 11}
                </button>
                <button
                  type="button"
                  className="month-picker-nav-btn"
                  onClick={() => setYearPageStart((s) => s + 12)}
                  disabled={yearPageStart + 12 > endYear}
                  aria-label="Later years"
                  title="Later years"
                >
                  ›
                </button>
              </div>

              <div className="month-picker-grid" role="grid" aria-label="Years">
                {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map(
                  (y) => {
                    const outOfRange = y < startYear || y > endYear;
                    return (
                      <button
                        key={y}
                        type="button"
                        disabled={outOfRange}
                        onClick={() => handleSelectYear(y)}
                        className={`month-picker-month-btn ${
                          parsed?.year === y ? "is-selected" : ""
                        } ${y === currentYear ? "is-current" : ""}`}
                        aria-pressed={parsed?.year === y}
                      >
                        {y}
                      </button>
                    );
                  },
                )}
              </div>
            </>
          )}
          {/* Footer with shortcuts */}
          <div className="month-picker-footer">
            <button
              type="button"
              className="month-picker-action-btn"
              onClick={handleThisMonth}
            >
              This month
            </button>
            {value ? (
              <button
                type="button"
                className="month-picker-action-btn"
                onClick={handleClear}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
