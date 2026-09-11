/**
 * Travelog — Application top bar (new UI §1.1)
 *
 * White sticky bar with a thin bottom border and the black Travelog
 * wordmark on the left. In the middle there is a slot for page-specific
 * content (on the trips dashboard: the search field and the global action
 * menu); on the right the settings gear.
 *
 * The old navigation tabs are gone by design: the scans page is reached
 * from the global action menu and the settings from the gear.
 */

import { CompassIcon, GearIcon } from "./icons";

interface TopBarProps {
  /** Receives the node where the page injects its own content. */
  slotRef?: (node: HTMLDivElement | null) => void;
  /** Brand click: back to the trips dashboard (§1.1). */
  onHome: () => void;
  onOpenSettings: () => void;
}

export default function TopBar({ slotRef, onHome, onOpenSettings }: TopBarProps) {
  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={onHome}>
        <CompassIcon size={24} /> Travelog
      </button>

      <div className="app-header-slot" ref={slotRef} />

      <button
        type="button"
        className="icon-button app-header-settings"
        aria-label="Impostazioni"
        title="Impostazioni"
        onClick={onOpenSettings}
      >
        <GearIcon size={20} />
      </button>
    </header>
  );
}
