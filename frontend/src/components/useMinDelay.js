import { useEffect, useRef, useState } from "react";

export default function useMinDelay(active, minMs = 3000) {
  const [visible, setVisible] = useState(false);
  const startRef = useRef(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (active) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (!visible) {
        setVisible(true);
        startRef.current = Date.now();
      }
    } else {
      const elapsed = Date.now() - startRef.current;
      if (elapsed >= minMs) {
        setVisible(false);
      } else {
        const remaining = Math.max(minMs - elapsed, 0);
        timeoutRef.current = setTimeout(() => {
          setVisible(false);
          timeoutRef.current = null;
        }, remaining);
      }
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, minMs, visible]);

  return active || visible;
}
