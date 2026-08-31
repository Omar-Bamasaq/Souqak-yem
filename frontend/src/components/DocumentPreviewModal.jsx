import React, { useEffect, useRef, useState } from "react";

export default function DocumentPreviewModal({ isOpen, src, onClose, title = "معاينة المستند" }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      dragStartRef.current = null;
    }
  }, [isOpen]);

  const handleMouseDown = (event) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStartRef.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  };

  const handleMouseMove = (event) => {
    if (!dragging || scale <= 1 || !dragStartRef.current) return;
    setOffset({
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  if (!isOpen || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-3 sm:p-6"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-black/30 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-white/90">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="إغلاق"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="text-sm font-bold">{title}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
              disabled={scale >= 4}
              title="تكبير"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setScale(prev => {
                  const next = Math.max(prev - 0.5, 1);
                  if (next === 1) setOffset({ x: 0, y: 0 });
                  return next;
                });
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
              disabled={scale <= 1}
              title="تصغير"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="إعادة ضبط"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex h-[92vh] max-h-[92vh] items-center justify-center overflow-hidden bg-black/40 p-6 pt-16">
          <div
            className={`relative flex max-h-full max-w-full items-center justify-center select-none transition-transform duration-200 ease-out ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          >
            <img
              src={src}
              alt={title}
              className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
