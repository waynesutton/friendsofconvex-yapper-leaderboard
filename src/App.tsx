import { Route, Routes } from "react-router-dom";
import { BuiltWithFooter } from "./components/BuiltWithFooter";
import { SiteHeader } from "./components/SiteHeader";
import { AboutPage } from "./pages/AboutPage";
import { AdminDocsPage } from "./pages/AdminDocsPage";
import { AdminGiftLabPage } from "./pages/AdminGiftLabPage";
import { AdminGiftsGuidePage } from "./pages/AdminGiftsGuidePage";
import { AdminGiftsPage } from "./pages/AdminGiftsPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminSetupPage } from "./pages/AdminSetupPage";
import { GiftLabPassPage } from "./pages/GiftLabPassPage";
import { GiftPassPage } from "./pages/GiftPassPage";
import { GiftSharePage } from "./pages/GiftSharePage";
import { HomePage } from "./pages/HomePage";
import { JoinPage } from "./pages/JoinPage";
import { Providers } from "./providers";

export function App() {
  return (
    <Providers>
      <SiteHeader />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/admin" element={<AdminPage />} />
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
