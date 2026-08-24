"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Destination = { href: string; label: string; description: string };

export function CompactNavigation({ destinations, active }: { destinations: readonly Destination[]; active: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); };
  const triggerLabel = `${open ? "Close" : "Open"} primary navigation. Current destination: ${active}`;

  useEffect(() => {
    const narrowViewport = window.matchMedia("(max-width: 40rem)");
    const closeForWideViewport = () => { if (!narrowViewport.matches) setOpen(false); };
    closeForWideViewport();
    narrowViewport.addEventListener("change", closeForWideViewport);
    return () => narrowViewport.removeEventListener("change", closeForWideViewport);
  }, []);

  return <nav className="compact-navigation" aria-label="Primary navigation" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); close(); } }}>
    <button ref={triggerRef} type="button" className="neutral-action compact-navigation-trigger" aria-label={triggerLabel} aria-expanded={open} aria-controls="compact-primary-navigation" onClick={() => setOpen((visible) => !visible)}>Menu: {active}</button>
    {open ? <div id="compact-primary-navigation" className="compact-navigation-menu">{destinations.map((destination) => <Link key={destination.href} href={destination.href} aria-current={active === destination.label ? "page" : undefined} onClick={() => setOpen(false)}><span>{destination.label}</span><small>{destination.description}</small></Link>)}</div> : null}
  </nav>;
}
