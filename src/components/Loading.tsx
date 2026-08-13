"use client";

export default function Loading({ message = "Connecting…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-neutral-300">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-600 border-t-white" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
