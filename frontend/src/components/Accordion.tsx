/**
 * Travelog MVP1 — Collapsible accordion panel
 *
 * A `.panel` whose body can be collapsed/expanded via its header
 * toggle. Used for secondary sections (scan history, operations
 * history). Content is unmounted while collapsed.
 */

import { useState, type ReactNode } from "react";

interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  /** Whether the section starts expanded (default: collapsed). */
  defaultOpen?: boolean;
}

export default function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel accordion">
      <div className="panel-header accordion-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="secondary accordion-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Nascondi ▴" : "Mostra ▾"}
        </button>
      </div>
      {open && <div className="accordion-body">{children}</div>}
    </section>
  );
}
