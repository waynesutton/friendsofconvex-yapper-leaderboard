import { useQuery } from "convex/react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { usePageTitle } from "../lib/usePageTitle";

// The default Yappers board keeps a clean URL with no ?board= param.
const DEFAULT_BOARD = "impressions";

// /b/:id is a frozen board share. Crawlers read its meta tags from the HTTP
// route; people who tap the card land here and move to the board for that
// tab, on the saved day when the share froze one. Unknown ids go home.
export function BoardSharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const share = useQuery(api.boardShares.getBoardShare, {
    shareId: shareId ?? "",
  });

  usePageTitle("Opening the board");

  if (share === undefined) {
    return <div className="gift-portal-state">Opening the board…</div>;
  }
  if (share === null) {
    return <Navigate to="/" replace />;
  }
  const params = new URLSearchParams();
  if (share.board !== DEFAULT_BOARD) params.set("board", share.board);
  if (share.rankingDay) params.set("day", share.rankingDay);
  const query = params.toString();
  return <Navigate to={query ? `/?${query}` : "/"} replace />;
}
