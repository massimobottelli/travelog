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
import ScansPage from "./pages/ScansPage";
import PhotosPage from "./pages/PhotosPage";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import SettingsPage from "./pages/SettingsPage";
import { useRoute, navigate } from "./hooks/useRoute";

function App() {
  const route = useRoute();
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
          {route.name === "scans" && <ScansPage onNavigateTrips={() => navigate("/trips")} />}
          {route.name === "photos" && <PhotosPage />}
          {route.name === "trips" && <TripsPage />}
          {route.name === "tripDetail" && <TripDetailPage tripId={route.tripId} />}
          {route.name === "settings" && <SettingsPage />}
        </main>
      </div>
    </TopBarSlotProvider>
  );
}

export default App;
