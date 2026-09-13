/**
 * Travelog — Modal dialog wrapper (new UI)
 *
 * Renders its content in a centered modal box over a dimmed overlay:
 * - the box is 50% of the page width (with safe min/max bounds),
 *   centered horizontally and vertically on the viewport;
 * - long content scrolls inside the box instead of growing the page;
 * - the portal attachment (`document.body`) keeps the overlay above any
 *   clipping ancestor, exactly like the trip context dropdown.
 */

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  children: ReactNode;
  /** Accessible label of the modal container. */
  label?: string;
}

export default function Modal({ children, label }: ModalProps) {
  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={label}>
      <div className="modal-box">{children}</div>
    </div>,
    document.body,
  );
}
