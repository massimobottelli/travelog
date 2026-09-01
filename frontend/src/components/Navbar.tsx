/**
 * Travelog MVP1 — Horizontal navigation bar
 *
 * Top bar with brand and icon navigation items (horizontal layout
 * on every screen size, same style as the previous mobile view).
 */

import { ScanIcon, PhotoIcon, SettingsIcon } from "./icons";

export type Page = "scans" | "photos" | "settings";

interface NavItem {
  key: Page;
  label: string;
  icon: typeof ScanIcon;
}

const NAV_ITEMS: NavItem[] = [
  { key: "scans", label: "Scansioni", icon: ScanIcon },
  { key: "photos", label: "Foto", icon: PhotoIcon },
  { key: "settings", label: "Impostazioni", icon: SettingsIcon },
];

interface NavbarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

export default function Navbar({ page, onNavigate }: NavbarProps) {
  return (
    <header className="app-header">
      <span className="brand">Travelog</span>
      <nav className="app-nav" aria-label="Navigazione principale">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={page === item.key ? "nav-button active" : "nav-button"}
              onClick={() => onNavigate(item.key)}
              aria-label={item.label}
              aria-current={page === item.key ? "page" : undefined}
            >
              <Icon />
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
