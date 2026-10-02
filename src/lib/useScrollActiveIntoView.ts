import { useEffect, type RefObject } from "react";

// Keeps the active item of a horizontally scrolling strip in view. It only
// sets the strip's scrollLeft, so the page never jumps vertically the way
// element.scrollIntoView can. The strip must be a positioned element so
// offsetLeft is measured from it.
export function useScrollActiveIntoView(
  stripRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  activeKey: unknown,
) {
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    const active = strip.querySelector<HTMLElement>(activeSelector);
    if (!active) return;
    const left = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? "auto" : "smooth" });
  }, [stripRef, activeSelector, activeKey]);
}
