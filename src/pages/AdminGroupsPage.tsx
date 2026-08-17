import { AdminGate } from "../components/AdminGate";
import { GroupsPanel } from "../components/GroupsPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminGroupsPage() {
  usePageTitle("Groups");
  return (
    <AdminGate redirectTo="/admin/groups">
      <GroupsPanel />
    </AdminGate>
  );
}
