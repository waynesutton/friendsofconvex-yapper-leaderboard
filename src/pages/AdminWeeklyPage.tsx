import { AdminGate } from "../components/AdminGate";
import { WeeklyAdminPanel } from "../components/WeeklyAdminPanel";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminWeeklyPage() {
  usePageTitle("Weekly top 10");
  return (
    <AdminGate redirectTo="/admin/weekly">
      <WeeklyAdminPanel />
    </AdminGate>
  );
}
