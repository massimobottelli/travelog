/**
 * Travelog MVP1 — Application shell
 *
 * Horizontal top-bar navigation based on React state (no router
 * library in MVP1).
 */

import { useState } from "react";
import Navbar, { type Page } from "./components/Navbar";
import ScansPage from "./pages/ScansPage";
import PhotosPage from "./pages/PhotosPage";
import TripsPage from "./pages/TripsPage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  const [page, setPage] = useState<Page>("scans");

  return (
    <div className="app">
      <Navbar page={page} onNavigate={setPage} />
      <main className="app-main">
        {page === "scans" && <ScansPage />}
        {page === "photos" && <PhotosPage />}
        {page === "trips" && <TripsPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
