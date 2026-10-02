import { AdminGate } from "../components/AdminGate";
import { MentionQueuePanel } from "../components/MentionQueuePanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminQueuePage() {
  usePageTitle("Mention queue");
  return (
    <AdminGate redirectTo="/admin/queue">
      <MentionQueuePanel />
    </AdminGate>
  );
}
