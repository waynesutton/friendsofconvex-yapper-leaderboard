import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type FilterDropdownOption<T extends string> = {
  value: T;
  label: string;
};

// Themed dropdown that replaces native <select>. The trigger reuses the
// secondary button treatment so it matches whichever theme is active, and the
// menu closes on outside click, Escape, or selection.
export function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: T;
  options: Array<FilterDropdownOption<T>>;
  onChange: (value: T) => void;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
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

  const selected = options.find((option) => option.value === value);

  return (
    <div className="filter-dropdown" ref={rootRef}>
      <button
        type="button"
        className="secondary-button filter-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((current) => !current)}>
        {icon}
        <span>{selected?.label ?? label}</span>
        <CaretDownIcon
          aria-hidden="true"
          className="filter-dropdown-caret"
          data-open={open || undefined}
        />
      </button>
      {open ? (
        <div
          className="filter-dropdown-menu"
          role="listbox"
          id={menuId}
          aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}>
              <span>{option.label}</span>
              {option.value === value ? <CheckIcon aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
