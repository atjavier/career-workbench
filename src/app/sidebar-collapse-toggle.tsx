"use client";

import { useState } from "react";

export function SidebarCollapseToggle() {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      const shell = document.querySelector(".application-shell");
      if (shell) {
        shell.classList.toggle("is-collapsed", next);
      }
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
      <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
    </button>
  );
}
