/**
 * Travelog MVP1 — Application shell
 *
 * URL-based navigation: the tab pages live at their own path and the
 * trip detail card is a standalone shareable page (`/trips/:id`).
 * The routing itself is a minimal pathname parser (see hooks/useRoute),
 * not a router library.
 */

import Navbar, { type Page } from "./components/Navbar";
import ScansPage from "./pages/ScansPage";
import PhotosPage from "./pages/PhotosPage";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import SettingsPage from "./pages/SettingsPage";
import { useRoute, navigate, type Route } from "./hooks/useRoute";

const PAGE_PATHS: Record<Page, string> = {
  trips: "/trips",
  scans: "/scans",
  photos: "/photos",
  settings: "/settings",
};

/** Route → active navbar tab (the detail page highlights "Viaggi"). */
function activePage(route: Route): Page {
  switch (route.name) {
    case "scans":
      return "scans";
    case "photos":
      return "photos";
    case "settings":
      return "settings";
    default:
      return "trips";
  }
}

function App() {
  const route = useRoute();
  return (
    <div className="app">
      <Navbar page={activePage(route)} onNavigate={(page) => navigate(PAGE_PATHS[page])} />
      <main className="app-main">
        {route.name === "scans" && <ScansPage onNavigateTrips={() => navigate("/trips")} />}
        {route.name === "photos" && <PhotosPage />}
        {route.name === "trips" && <TripsPage />}
        {route.name === "tripDetail" && <TripDetailPage tripId={route.tripId} />}
        {route.name === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
