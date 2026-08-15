import { useParams } from "react-router-dom";
import { GiftShareCard } from "../components/GiftPortal";
import { usePageTitle } from "../lib/usePageTitle";

export function GiftSharePage() {
  usePageTitle("Friend of Convex");
  const { token } = useParams<{ token: string }>();
  return <GiftShareCard token={token ?? ""} />;
}
