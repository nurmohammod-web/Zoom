"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getGuestName, setGuestName } from "../lib/guest";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getGuestName());
  }, []);

  const persistName = () => setGuestName(name.trim());

  const createRoom = async () => {
    setError(null);
    if (!name.trim()) return setError("Please enter your name first.");
    persistName();
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create room");
        return;
      }
      router.push(`/room/${data.slug}`);
    } catch {
      setError("Could not reach the server");
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please enter your name first.");
    const slug = code.trim().toLowerCase();
    if (!slug) return setError("Enter a room code.");
    persistName();
    router.push(`/room/${slug}`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-5 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Zoom<span className="text-blue-500">-lite</span>
        </h1>
        <p className="mt-2 text-neutral-400">
          Peer-to-peer video calls for up to 4 people. No sign-up — just a name.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-neutral-300">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex"
          className="rounded-lg bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 outline-none ring-1 ring-white/10 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400 ring-1 ring-red-500/30">
          {error}
        </p>
      )}

      <button
        onClick={createRoom}
        disabled={creating}
        className="rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create a new room"}
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-600">
        <span className="h-px flex-1 bg-neutral-800" />
        or join with a code
        <span className="h-px flex-1 bg-neutral-800" />
      </div>

      <form onSubmit={joinRoom} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Room code"
          className="flex-1 rounded-lg bg-neutral-800 px-4 py-3 font-mono text-white placeholder-neutral-500 outline-none ring-1 ring-white/10 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-neutral-700 px-5 py-3 font-medium text-white transition hover:bg-neutral-600"
        >
          Join
        </button>
      </form>
    </main>
  );
}
