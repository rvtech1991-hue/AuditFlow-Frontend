import { useEffect } from "react";
import type { RefObject } from "react";

/** Closes an open dropdown/menu/popover when the user clicks anywhere outside `ref`'s element.
 * Only listens while `enabled` is true, so closed menus don't pay for an idle document listener. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutsideClick: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutsideClick();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [ref, onOutsideClick, enabled]);
}
