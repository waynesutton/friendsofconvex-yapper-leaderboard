import { CircleHalfIcon } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

const THEME_STORAGE_KEY = "friends-of-convex-theme";

type SiteTheme = "convex" | "studio";

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("friends-of-convex-theme-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("friends-of-convex-theme-change", onStoreChange);
  };
}

function getThemeSnapshot(): SiteTheme {
  const activeTheme = document.documentElement.dataset.theme;
  return activeTheme === "studio" ? "studio" : "convex";
}

// Icon-only theme toggle: one Phosphor glyph, no label or logo.
export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "convex");

  function toggleTheme() {
    const nextTheme: SiteTheme = theme === "convex" ? "studio" : "convex";
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The in-page switch still works when a privacy mode blocks local storage.
    }
    window.dispatchEvent(new Event("friends-of-convex-theme-change"));
  }

  const nextThemeName = theme === "convex" ? "Studio" : "Convex";

  return (
    <button
      className="theme-switcher"
      type="button"
      onClick={toggleTheme}
      aria-label={`Current theme: ${theme}. Switch to ${nextThemeName} theme`}
      title={`Switch to the ${nextThemeName} theme`}
    >
      <CircleHalfIcon size={19} weight="bold" aria-hidden="true" />
    </button>
  );
}
