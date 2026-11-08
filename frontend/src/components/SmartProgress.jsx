import React, { useEffect, useRef, useState } from "react";

export default function SmartProgress({ percent, message }) {
  const progressRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const element = progressRef.current;
    if (!element || !("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      const isAboveViewport = entry.rootBounds
        && entry.boundingClientRect.bottom <= entry.rootBounds.top;
      setIsCompact(!entry.isIntersecting && isAboveViewport);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const progressBar = (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs font-bold leading-5 text-blue-900">{message}</p>
        <span className="shrink-0 text-xs font-black tabular-nums text-blue-800" dir="ltr">{percent}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-blue-100"
        role="progressbar"
        aria-label="تقدم إكمال الإعلان"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );

  return (
    <>
      <div ref={progressRef} className="w-full">
        {progressBar}
      </div>
      {isCompact && (
        <div
          className="fixed left-2 right-2 top-[calc(61px+env(safe-area-inset-top,0px))] z-[35] mx-auto max-w-xl md:top-[calc(71px+env(safe-area-inset-top,0px))]"
          aria-hidden="true"
        >
          {progressBar}
        </div>
      )}
    </>
  );
}
