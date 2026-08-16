import { AdminGate } from "../components/AdminGate";
import { GiftLabPanel } from "../components/GiftLabPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminGiftLabPage() {
  usePageTitle("Gift lab");
  return (
    <AdminGate redirectTo="/admin/gift-lab">
      <GiftLabPanel />
    </AdminGate>
  );
}
