import { AdminGate } from "../components/AdminGate";
import { GiftAdminPanel } from "../components/GiftAdminPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminGiftsPage() {
  usePageTitle("Gift studio");
  return (
    <AdminGate redirectTo="/admin/gifts">
      <GiftAdminPanel />
    </AdminGate>
  );
}
