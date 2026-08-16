import { InfoIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

// Small accessible definition popover used on leaderboard column headers so a
// reader can see exactly how a number is measured without leaving the board.
// Opens on hover and focus, toggles on click for touch, and closes on Escape,
// blur, or an outside pointer press.
export function MetricInfo({ label, definition }: { label: string; definition: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const bubbleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span
      className="metric-info"
      ref={rootRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="metric-info-trigger"
        aria-label={`How ${label} is measured`}
        aria-expanded={open}
        aria-describedby={open ? bubbleId : undefined}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}>
        <InfoIcon aria-hidden="true" />
      </button>
      {open ? (
        <span className="metric-info-bubble" id={bubbleId} role="tooltip">
          <strong>{label}</strong>
          {definition}
        </span>
      ) : null}
    </span>
  );
}
