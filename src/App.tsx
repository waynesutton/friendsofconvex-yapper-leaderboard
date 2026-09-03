import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { BuiltWithFooter } from "./components/BuiltWithFooter";
import { SiteHeader } from "./components/SiteHeader";
import { AboutPage } from "./pages/AboutPage";
import { AdminDocsPage } from "./pages/AdminDocsPage";
import { AdminGiftLabPage } from "./pages/AdminGiftLabPage";
import { AdminGiftsGuidePage } from "./pages/AdminGiftsGuidePage";
import { AdminGiftsPage } from "./pages/AdminGiftsPage";
import { AdminGroupsPage } from "./pages/AdminGroupsPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminSetupPage } from "./pages/AdminSetupPage";
import { GiftLabPassPage } from "./pages/GiftLabPassPage";
import { GiftPassPage } from "./pages/GiftPassPage";
import { GiftSharePage } from "./pages/GiftSharePage";
import { HomePage } from "./pages/HomePage";
import { JoinPage } from "./pages/JoinPage";
import { LegendPage } from "./pages/LegendPage";
import { Providers } from "./providers";

// Retire mode was renamed to Legends. Cards for the old URL are already out
// on X, so those links land here and move to the new one.
function LegacyRetiredRedirect() {
  const { handle } = useParams<{ handle: string }>();
  return <Navigate to={`/legends/${handle ?? ""}`} replace />;
}

export function App() {
  return (
    <Providers>
      <SiteHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/legends/:handle" element={<LegendPage />} />
          <Route path="/retired/:handle" element={<LegacyRetiredRedirect />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/groups" element={<AdminGroupsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/docs" element={<AdminDocsPage />} />
          <Route path="/admin/setup" element={<AdminSetupPage />} />
          <Route path="/admin/gifts" element={<AdminGiftsPage />} />
          <Route path="/admin/gifts/guide" element={<AdminGiftsGuidePage />} />
          <Route path="/admin/gift-lab" element={<AdminGiftLabPage />} />
          <Route path="/gift/share/:token" element={<GiftSharePage />} />
          <Route path="/gift/for/:token" element={<GiftLabPassPage />} />
          <Route path="/gift/:token" element={<GiftPassPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <BuiltWithFooter />
    </Providers>
  );
}
