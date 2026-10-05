"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Dialog({ open, onClose, busy = false, title, description, children }: {
  open: boolean; onClose: () => void; busy?: boolean; title: string; description?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="workspace-dialog" aria-labelledby={`${id}-title`}
    aria-describedby={description ? `${id}-description` : undefined}
    onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose}>
    <h2 id={`${id}-title`}>{title}</h2>
    {description ? <p id={`${id}-description`}>{description}</p> : null}
    {children}
  </dialog>;
}
