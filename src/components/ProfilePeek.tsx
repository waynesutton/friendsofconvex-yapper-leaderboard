import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { compactNumber } from "./formatters";

// Avatar hover peek: a small studio call sheet card with the person's synced X
// bio, follower count, and an Open on X link. Opens after a short hover delay
// or immediately on keyboard focus, toggles on tap for touch, and closes on
// Escape, blur, outside press, or scroll. The parent (the leaderboard) owns
// the open state so only one card shows at a time.

const OPEN_DELAY_MS = 280;
const CLOSE_DELAY_MS = 120;
const VIEWPORT_MARGIN = 12;

type PeekProfile = {
  handle: string;
  displayName: string;
  bio: string | null;
  currentFollowers: number;
  syncStatus: "pending" | "synced" | "error";
};

// Splits a bio into text, @mention links, and raw URL links. Mentions go to
// the handle's X page; URLs render without their protocol to stay compact.
function bioNodes(bio: string): ReactNode[] {
  const parts = bio.split(/(@[A-Za-z0-9_]{1,15}|https?:\/\/\S+)/g);
  return parts.map((part, index) => {
    if (/^@[A-Za-z0-9_]{1,15}$/.test(part)) {
      return (
        <a
          key={index}
          href={`https://x.com/${part.slice(1)}`}
          target="_blank"
          rel="noreferrer noopener">
          {part}
        </a>
      );
    }
    if (/^https?:\/\//.test(part)) {
      const display = part.replace(/^https?:\/\//, "").replace(/\/$/, "");
      return (
        <a key={index} href={part} target="_blank" rel="noreferrer noopener">
          {display}
        </a>
      );
    }
    return part;
  });
}

export function ProfilePeek({
  profile,
  open,
  onOpenChange,
  children,
}: {
  profile: PeekProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const cardId = useId();

  function clearTimers() {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  useEffect(() => clearTimers, []);

  // Position the card from the avatar rect with position: fixed so the
  // table's overflow: hidden cannot clip it. Below-left by default, flipped
  // above near the viewport bottom, shifted left near the right edge. The
  // card mounts hidden at 0,0 and this measures it before paint.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!trigger || !card) return;
    const rect = trigger.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    let top = rect.bottom + 8;
    if (top + cardRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = rect.top - 8 - cardRect.height;
    }
    let left = rect.left;
    if (left + cardRect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - VIEWPORT_MARGIN - cardRect.width;
    }
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.visibility = "visible";
  }, [open]);

  // Escape, outside press, and scroll all close the card while it is open.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    }
    function handleScroll() {
      onOpenChange(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [open, onOpenChange]);

  // Mouse-only hover timers; touch goes through the click toggle instead.
  function handlePointerEnter(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") return;
    clearTimers();
    if (open) return;
    openTimer.current = window.setTimeout(() => onOpenChange(true), OPEN_DELAY_MS);
  }

  function handlePointerLeave(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") return;
    clearTimers();
    if (!open) return;
    closeTimer.current = window.setTimeout(() => onOpenChange(false), CLOSE_DELAY_MS);
  }

  // Keyboard focus opens right away; taps and mouse clicks skip this so the
  // click toggle below stays the single source of truth for them.
  function handleFocus(event: FocusEvent<HTMLButtonElement>) {
    if (event.target.matches(":focus-visible")) {
      clearTimers();
      onOpenChange(true);
    }
  }

  function handleBlur(event: FocusEvent) {
    if (rootRef.current && !rootRef.current.contains(event.relatedTarget as Node)) {
      onOpenChange(false);
    }
  }

  return (
    <span
      className="profile-peek"
      ref={rootRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onBlur={handleBlur}>
      <button
        type="button"
        className="profile-peek-trigger"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        aria-label={`View bio for ${profile.displayName}`}
        onClick={() => {
          clearTimers();
          onOpenChange(!open);
        }}
        onFocus={handleFocus}>
        {children}
      </button>
      {open ? (
        <div
          className="profile-peek-card"
          id={cardId}
          ref={cardRef}
          style={{ top: 0, left: 0, visibility: "hidden" }}>
          <p className="profile-peek-identity">
            <strong>{profile.displayName}</strong>
            <a
              href={`https://x.com/${profile.handle}`}
              target="_blank"
              rel="noreferrer noopener">
              @{profile.handle}
            </a>
          </p>
          {profile.bio ? <p className="profile-peek-bio">{bioNodes(profile.bio)}</p> : null}
          <p className="profile-peek-footer">
            {profile.syncStatus === "synced" ? (
              <span className="profile-peek-followers">
                {compactNumber(profile.currentFollowers)} followers
              </span>
            ) : (
              <span className="profile-peek-followers">Awaiting sync</span>
            )}
            <a
              className="profile-peek-open"
              href={`https://x.com/${profile.handle}`}
              target="_blank"
              rel="noreferrer noopener">
              Open on X
            </a>
          </p>
        </div>
      ) : null}
    </span>
  );
}
