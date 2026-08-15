import { useSearchParams } from "react-router-dom";
import { Leaderboard } from "../components/Leaderboard";
import { usePageTitle } from "../lib/usePageTitle";

export function HomePage() {
  usePageTitle();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  return <Leaderboard initialSearch={initialSearch} />;
}
