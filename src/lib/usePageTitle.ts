import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";

// Replaces the Next.js metadata title template in the single page app.
// The base title and the suffix come from admin site settings; the shipped
// defaults apply while the branding query loads and on untouched deploys.
export function usePageTitle(title?: string) {
  const branding = useQuery(api.siteSettings.getSiteBranding, {});
  const baseTitle = branding?.siteTitle ?? DEFAULT_BRANDING.siteTitle;
  const communityName = branding?.communityName ?? DEFAULT_BRANDING.communityName;

  useEffect(() => {
    document.title = title ? `${title} · ${communityName}` : baseTitle;
    return () => {
      document.title = baseTitle;
    };
  }, [title, baseTitle, communityName]);
}
