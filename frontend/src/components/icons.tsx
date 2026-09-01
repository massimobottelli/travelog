/**
 * Travelog MVP1 — Inline SVG icons
 *
 * Minimal icon set to avoid adding an icon library dependency.
 */

interface IconProps {
  size?: number;
}

function base(size: number | undefined): { width: number; height: number; viewBox: string } {
  return { width: size ?? 18, height: size ?? 18, viewBox: "0 0 24 24" };
}

export function ScanIcon({ size }: IconProps) {
  return (
    <svg
      {...base(size)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

export function PhotoIcon({ size }: IconProps) {
  return (
    <svg
      {...base(size)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function TripIcon({ size }: IconProps) {
  return (
    <svg
      {...base(size)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" />
      <path d="M3 13h18" />
    </svg>
  );
}

export function SettingsIcon({ size }: IconProps) {
  return (
    <svg
      {...base(size)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="7" cy="17" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
