"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "career_workspace_sidebar_collapsed";

export function SidebarCollapseToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const isSaved = localStorage.getItem(STORAGE_KEY) === "true";
      if (isSaved) {
        setCollapsed(true);
        document
          .querySelector(".application-shell")
          ?.classList.add("is-collapsed");
        document.documentElement.classList.add("sidebar-collapsed");
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      } catch {
        // ignore localStorage errors
      }
      const shell = document.querySelector(".application-shell");
      if (shell) {
        shell.classList.toggle("is-collapsed", next);
      }
      document.documentElement.classList.toggle("sidebar-collapsed", next);
      return next;
    });
  };

  return (
    <button
      type="button"
      className="sidebar-collapse-button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={toggle}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </svg>
    </button>
  );
}
