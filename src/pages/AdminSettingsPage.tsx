import { AdminGate } from "../components/AdminGate";
import { SiteSettingsPanel } from "../components/SiteSettingsPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminSettingsPage() {
  usePageTitle("Site settings");
  return (
    <AdminGate redirectTo="/admin/settings">
      <SiteSettingsPanel />
    </AdminGate>
  );
}
