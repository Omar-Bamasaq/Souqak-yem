import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const SCROLL_POSITIONS_KEY = "souqak-scroll-positions";
const MAX_SAVED_POSITIONS = 100;

function readSavedPositions() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SCROLL_POSITIONS_KEY) || "{}");
    return new Map(Object.entries(value));
  } catch {
    return new Map();
  }
}

function getScrollPosition() {
  return {
    x: window.scrollX || document.documentElement.scrollLeft || 0,
    y: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  };
}

function scrollToPosition(position) {
  window.scrollTo(position.x, position.y);
  document.documentElement.scrollTo(position.x, position.y);
  document.body.scrollTo(position.x, position.y);
  document.getElementById("root")?.scrollTo(position.x, position.y);
}

/**
 * Component that scrolls the window to the top whenever the location changes,
 * but only for new navigations (PUSH/REPLACE). It saves and restores scroll
 * positions for each history entry on BACK/FORWARD (POP).
 * It also ignores scrolling if only the 'page' parameter changes in the URL.
 */
export default function ScrollToTop() {
  const { pathname, search, hash, key } = useLocation();
  const navType = useNavigationType();
  const prevPathname = useRef(pathname);
  const prevSearch = useRef(search);
  const positionsRef = useRef(readSavedPositions());
  const activeKeyRef = useRef(key);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const saveCurrentPosition = () => {
      const positions = positionsRef.current;
      positions.delete(activeKeyRef.current);
      positions.set(activeKeyRef.current, getScrollPosition());
      while (positions.size > MAX_SAVED_POSITIONS) {
        positions.delete(positions.keys().next().value);
      }
      try {
        sessionStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(Object.fromEntries(positions)));
      } catch {
        // In-memory restoration still works when session storage is unavailable.
      }
    };

    window.addEventListener("scroll", saveCurrentPosition, { passive: true });
    window.addEventListener("pagehide", saveCurrentPosition);
    return () => {
      saveCurrentPosition();
      window.removeEventListener("scroll", saveCurrentPosition);
      window.removeEventListener("pagehide", saveCurrentPosition);
    };
  }, []);

  useLayoutEffect(() => {
    const previousKey = activeKeyRef.current;
    if (previousKey !== key) {
      activeKeyRef.current = key;
    }

    if (navType === "POP") {
      const position = positionsRef.current.get(key);
      if (position) {
        let cancelled = false;
        const restore = () => {
          if (!cancelled) scrollToPosition(position);
        };
        const cancelRestoration = () => {
          cancelled = true;
        };
        const frameId = requestAnimationFrame(restore);
        const timeouts = [0, 100, 300, 800].map((delay) => setTimeout(restore, delay));
        window.addEventListener("wheel", cancelRestoration, { once: true, passive: true });
        window.addEventListener("touchstart", cancelRestoration, { once: true, passive: true });
        window.addEventListener("keydown", cancelRestoration, { once: true });

        prevPathname.current = pathname;
        prevSearch.current = search;
        return () => {
          cancelled = true;
          cancelAnimationFrame(frameId);
          timeouts.forEach(clearTimeout);
          window.removeEventListener("wheel", cancelRestoration);
          window.removeEventListener("touchstart", cancelRestoration);
          window.removeEventListener("keydown", cancelRestoration);
        };
      }
    }

    // Only scroll to top on new navigation (PUSH or REPLACE)
    if (navType !== "POP") {
      const normalizedPathname = pathname.replace(/\/$/, "");
      const normalizedPrevPathname = prevPathname.current.replace(/\/$/, "");
      
      // Determine if we should scroll to top
      let shouldScroll = false;

      const isCategoryPath = (p) => p.startsWith("/category/");

      if (normalizedPathname !== normalizedPrevPathname) {
        // Paths changed
        const getBaseCategory = (p) => p.split("/").slice(0, 3).join("/").replace(/\/$/, "");

        if (isCategoryPath(normalizedPathname) && isCategoryPath(normalizedPrevPathname)) {
          if (getBaseCategory(normalizedPathname) === getBaseCategory(normalizedPrevPathname)) {
            // It's the same base category, just subcategory in path changed. Don't scroll.
            shouldScroll = false;
          } else {
            shouldScroll = true;
          }
        } else {
          // Always scroll to top when moving to a completely different page/path
          shouldScroll = true;
        }
      } else if (search !== prevSearch.current) {
        // Path is the same, but search params changed
        if (isCategoryPath(normalizedPathname)) {
          // If we are on a category page, don't scroll when changing filters/subcategories/page
          shouldScroll = false;
        } else {
          // Path is the same, but search params changed (e.g., filters on search page)
          // Check if only the 'page' or 'sub' param changed
          const prevParams = new URLSearchParams(prevSearch.current);
          const nextParams = new URLSearchParams(search);
          
          prevParams.delete("page");
          nextParams.delete("page");
          prevParams.delete("sub");
          nextParams.delete("sub");
          prevParams.delete("sort");
          nextParams.delete("sort");
          
          if (prevParams.toString() !== nextParams.toString()) {
            shouldScroll = true;
          }
        }
      }

      if (shouldScroll && !hash) {
        const scrollToTop = () => {
          scrollToPosition({ x: 0, y: 0 });
        };

        // 1. Synchronous attempt
        scrollToTop();

        // 2. Next frame
        const frameId = requestAnimationFrame(scrollToTop);

        // 3. Delayed attempt for async content
        const timeoutId = setTimeout(scrollToTop, 150);

        // Update refs
        prevPathname.current = pathname;
        prevSearch.current = search;

        return () => {
          cancelAnimationFrame(frameId);
          clearTimeout(timeoutId);
        };
      }
    }
    
    // Update refs anyway to track changes
    prevPathname.current = pathname;
    prevSearch.current = search;
  }, [key, pathname, search, navType]);

  return null;
}
