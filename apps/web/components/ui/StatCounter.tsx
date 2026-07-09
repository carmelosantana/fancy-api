"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates from 0 up to `value` on mount/whenever `value` changes — a small
 * bit of delight for the record/request counters.
 */
export function StatCounter({
  value,
  duration = 900,
  className = "",
  formatter = (n: number) => n.toLocaleString(),
}: {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = Number.isFinite(value) ? value : 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    }

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={className}>{formatter(display)}</span>;
}
