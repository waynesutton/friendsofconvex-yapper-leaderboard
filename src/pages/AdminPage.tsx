import { AdminGate } from "../components/AdminGate";
import { AdminPanel } from "../components/AdminPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminPage() {
  usePageTitle("Admin");
  return (
    <AdminGate>
      <AdminPanel />
    </AdminGate>
  );
}
