import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Scrolls the window to the top on pathname changes.
 * Does not manage chat message lists or modal scroll containers.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
