"use client";

import type { ReactNode } from "react";

// Responsive grid that adapts columns to participant count (1..4).
export default function VideoGrid({ count, children }: { count: number; children: ReactNode }) {
  const cols =
    count <= 1 ? "grid-cols-1" : count === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2";
  return (
    <div className={`grid ${cols} gap-3 sm:gap-4 w-full max-w-5xl mx-auto`}>{children}</div>
  );
}
