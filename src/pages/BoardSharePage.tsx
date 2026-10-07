import { useQuery } from "convex/react";
import { Navigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { usePageTitle } from "../lib/usePageTitle";

// The default Yappers board keeps a clean URL with no ?board= param.
const DEFAULT_BOARD = "impressions";

// /b/:id is a frozen board share. Crawlers read its meta tags from the HTTP
// route; people who tap the card land here and move to the live board for
// that tab. Unknown ids go to the home board.
export function BoardSharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const share = useQuery(api.boardShares.getBoardShare, {
    shareId: shareId ?? "",
  });

  usePageTitle("Opening the board");

  if (share === undefined) {
    return <div className="gift-portal-state">Opening the board…</div>;
  }
  if (share === null || share.board === DEFAULT_BOARD) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/?board=${encodeURIComponent(share.board)}`} replace />;
}
