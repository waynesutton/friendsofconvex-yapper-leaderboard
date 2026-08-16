import { useParams } from "react-router-dom";
import { GiftLabPortal } from "../components/GiftLabPortal";
import { usePageTitle } from "../lib/usePageTitle";

export function GiftLabPassPage() {
  usePageTitle("A signal of thanks");
  const { token } = useParams<{ token: string }>();
  return <GiftLabPortal token={token ?? ""} />;
}
