import { AdminGate } from "../components/AdminGate";
import { ShareVideoPanel } from "../components/ShareVideoPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminShareVideoPage() {
  usePageTitle("Share video");
  return (
    <AdminGate redirectTo="/admin/share-video">
      <ShareVideoPanel />
    </AdminGate>
  );
}
