"use client";

import { useEffect, useState } from "react";

const COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

// Plays once per `storageKey` per device, then never again.
export function Confetti({ storageKey }: { storageKey: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(storageKey);
      if (!seen) localStorage.setItem(storageKey, "1");
    } catch {
      // storage unavailable: still celebrate
    }
    if (seen) return;
    const start = setTimeout(() => setShow(true), 0);
    const stop = setTimeout(() => setShow(false), 4000);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [storageKey]);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animation: `confetti-fall ${2.2 + (i % 5) * 0.4}s ease-in ${(i % 8) * 0.15}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
