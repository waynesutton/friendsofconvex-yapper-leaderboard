import { AdminGate } from "../components/AdminGate";
import { AdminTeamPanel } from "../components/AdminTeamPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminTeamPage() {
  usePageTitle("Admins");
  return (
    <AdminGate redirectTo="/admin/team">
      <AdminTeamPanel />
    </AdminGate>
  );
}
