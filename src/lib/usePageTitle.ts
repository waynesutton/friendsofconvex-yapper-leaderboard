import { useEffect } from "react";

const BASE_TITLE = "Friends of Convex Yapper Board";

// Replaces the Next.js metadata title template in the single page app.
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Friends of Convex` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
