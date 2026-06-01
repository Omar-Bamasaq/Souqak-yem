import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Component that scrolls the window to the top whenever the location changes,
 * but only for new navigations (PUSH/REPLACE).
 * It allows the browser to restore scroll position on BACK/FORWARD (POP).
 * It also ignores scrolling if only the 'page' parameter changes in the URL.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navType = useNavigationType();
  const prevPathname = useRef(pathname);
  const prevSearch = useRef(search);

  useLayoutEffect(() => {
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

      if (shouldScroll) {
        const scrollToTop = () => {
          window.scrollTo(0, 0);
          document.documentElement.scrollTo(0, 0);
          document.body.scrollTo(0, 0);
          const root = document.getElementById('root');
          if (root) root.scrollTo(0, 0);
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
  }, [pathname, search, navType]);

  return null;
}
