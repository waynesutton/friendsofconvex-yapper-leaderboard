import { WeeklyBoards } from "../components/WeeklyBoards";
import { usePageTitle } from "../lib/usePageTitle";

export function WeeklyPage() {
  usePageTitle("Weekly top 10");
  return <WeeklyBoards />;
}
