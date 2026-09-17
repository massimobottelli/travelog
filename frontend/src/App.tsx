/**
 * Travelog MVP1 — Application shell
 *
 * URL-based navigation: the pages live at their own path and the trip
 * detail card is a standalone shareable page (`/trips/:id`). The routing
 * itself is a minimal pathname parser (see hooks/useRoute), not a router
 * library.
 *
 * The top bar (new UI §1.1) is white and holds the brand, a slot filled by
 * the current page (the trips search + global action menu) and the settings
 * gear. There are no navigation tabs anymore.
 */

import { useState } from "react";
import TopBar from "./components/TopBar";
import { TopBarSlotProvider } from "./components/TopBarSlot";
import ErrorBoundary from "./components/ErrorBoundary";
import ScansPage from "./pages/ScansPage";
import PhotosPage from "./pages/PhotosPage";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import SettingsPage from "./pages/SettingsPage";
import StatsPage from "./pages/StatsPage";
import { useRoute, navigate } from "./hooks/useRoute";

function App() {
  // navSeq identifies each navigation: the trips page is keyed on it so a
  // brand click (logo + title) restarts the dashboard from its initial
  // heatmap view even when `/trips` was already the current route.
  const { route, navSeq } = useRoute();
  // DOM node of the top bar slot: the rendered page portals its own header
  // content (search, global actions) into it.
  const [topBarSlot, setTopBarSlot] = useState<HTMLDivElement | null>(null);

  return (
    <TopBarSlotProvider node={topBarSlot}>
      <div className="app">
        <TopBar
          slotRef={setTopBarSlot}
          onHome={() => navigate("/trips")}
          onOpenSettings={() => navigate("/settings")}
        />
        <main className="app-main">
          {/* Each page is wrapped individually: a rendering error in one
              page shows the fallback UI without taking down the shell. */}
          <ErrorBoundary key={route.name === "tripDetail" ? `detail-${route.tripId}` : route.name}>
            {route.name === "scans" && <ScansPage onNavigateTrips={() => navigate("/trips")} />}
            {route.name === "stats" && <StatsPage />}
            {route.name === "photos" && <PhotosPage />}
            {route.name === "trips" && <TripsPage key={navSeq} />}
            {route.name === "tripDetail" && <TripDetailPage tripId={route.tripId} />}
            {route.name === "settings" && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>
    </TopBarSlotProvider>
  );
}

export default App;
