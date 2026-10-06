import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, type FocusEvent, type KeyboardEvent } from "react";

// Collapsible board search. Closed it is one icon button in the tools row;
// open it is an inline field that filters whichever board tab is active.
// It stays open while it holds a term, so a shared ?search= link shows it.
export function BoardSearch({
  value,
  onChange,
  open,
  onOpenChange,
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultCount: number | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Focus moves only after a user opens or closes the field, never on load.
  const focusInputPending = useRef(false);
  const focusTogglePending = useRef(false);

  function attachInput(node: HTMLInputElement | null) {
    inputRef.current = node;
    if (node && focusInputPending.current) {
      focusInputPending.current = false;
      node.focus();
    }
  }

  function attachToggle(node: HTMLButtonElement | null) {
    if (node && focusTogglePending.current) {
      focusTogglePending.current = false;
      node.focus();
    }
  }

  function openSearch() {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    focusInputPending.current = true;
    onOpenChange(true);
  }

  // "/" jumps to search from anywhere on the page, unless the reader is typing.
  useEffect(() => {
    function handleSlash(event: globalThis.KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      if (open) {
        inputRef.current?.focus();
      } else {
        focusInputPending.current = true;
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", handleSlash);
    return () => window.removeEventListener("keydown", handleSlash);
  }, [open, onOpenChange]);

  // Escape clears the term first, then folds the field back into the icon.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (value) {
      onChange("");
      return;
    }
    focusTogglePending.current = true;
    onOpenChange(false);
  }

  // Clicking away from an empty field folds it closed.
  function handleBlur(event: FocusEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (!value.trim()) onOpenChange(false);
  }

  if (!open) {
    return (
      <button
        ref={attachToggle}
        type="button"
        className="board-search-toggle"
        aria-label="Search this board"
        aria-expanded={false}
        title="Search this board (/)"
        onClick={openSearch}>
        <MagnifyingGlassIcon aria-hidden="true" />
      </button>
    );
  }

  return (
    <label className="search-field board-search" onBlur={handleBlur}>
      <MagnifyingGlassIcon aria-hidden="true" />
      <span className="sr-only">Search by name or X handle</span>
      <input
        ref={attachInput}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Name or @handle"
      />
      {resultCount !== null ? (
        <span className="board-search-count" aria-live="polite">
          {resultCount}
          <span className="sr-only">{resultCount === 1 ? " person" : " people"}</span>
        </span>
      ) : null}
    </label>
  );
}
