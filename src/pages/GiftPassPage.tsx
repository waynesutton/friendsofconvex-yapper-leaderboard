import { useParams } from "react-router-dom";
import { GiftPortal } from "../components/GiftPortal";
import { usePageTitle } from "../lib/usePageTitle";

export function GiftPassPage() {
  usePageTitle("Your gift pass");
  const { token } = useParams<{ token: string }>();
  return <GiftPortal token={token ?? ""} />;
}
