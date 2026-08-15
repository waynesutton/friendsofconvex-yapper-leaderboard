import { JoinBoard } from "../components/JoinBoard";
import { usePageTitle } from "../lib/usePageTitle";

export function JoinPage() {
  usePageTitle("Join the board");
  return <JoinBoard />;
}
