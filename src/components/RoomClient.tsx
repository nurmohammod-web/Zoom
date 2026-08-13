"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getGuestName, setGuestName } from "../lib/guest";
import { useWebRTC } from "../hooks/useWebRTC";
import VideoGrid from "./VideoGrid";
import VideoTile from "./VideoTile";
import ControlsBar from "./ControlsBar";
import ChatSidebar from "./ChatSidebar";
import Loading from "./Loading";

export default function RoomClient({ slug, roomName }: { slug: string; roomName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const participantIdRef = useRef<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);

  // Prefill the name from localStorage once on mount.
  useEffect(() => {
    const saved = getGuestName();
    setNameInput(saved);
    if (saved) {
      setName(saved);
      setJoined(true);
    }
  }, []);

  const {
    status,
    error,
    localStream,
    peers,
    micOn,
    camOn,
    toggleMic,
    toggleCamera,
    leave,
    messages,
    sendMessage,
  } = useWebRTC(slug, name, joined);

  // Record DB participation once we start connecting (enforces max-4 server-side too).
  useEffect(() => {
    if (!joined || !name) return;
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${slug}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (aborted) return;
        if (!res.ok) {
          setJoinError(data.error ?? "Could not join room");
          return;
        }
        participantIdRef.current = data.participantId ?? null;
      } catch {
        if (!aborted) setJoinError("Could not reach the server");
      }
    })();
    return () => {
      aborted = true;
    };
  }, [joined, name, slug]);

  // Best-effort leave record on tab close.
  useEffect(() => {
    const handler = () => {
      const pid = participantIdRef.current;
      if (pid) {
        navigator.sendBeacon?.(
          `/api/rooms/${slug}/leave`,
          new Blob([JSON.stringify({ participantId: pid })], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, [slug]);

  const unread = messages.length - seenCount;
  useEffect(() => {
    if (chatOpen) setSeenCount(messages.length);
  }, [chatOpen, messages.length]);

  const handleLeave = async () => {
    const pid = participantIdRef.current;
    leave();
    if (pid) {
      try {
        await fetch(`/api/rooms/${slug}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: pid }),
        });
      } catch {
        /* ignore */
      }
    }
    router.push("/");
  };

  // ---- Name gate ----
  if (!joined) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
        <h1 className="text-2xl font-semibold text-white">Join “{roomName}”</h1>
        <p className="mt-1 text-sm text-neutral-400">Enter a display name to join the call.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = nameInput.trim();
            if (!n) return;
            setGuestName(n);
            setName(n);
            setJoined(true);
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            className="rounded-lg bg-neutral-800 px-4 py-3 text-white placeholder-neutral-500 outline-none ring-1 ring-white/10 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500"
          >
            Join call
          </button>
        </form>
      </div>
    );
  }

  // ---- Error / full states ----
  if (status === "full" || joinError === "Room is full") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold text-white">Room is full</h1>
        <p className="mt-2 text-sm text-neutral-400">This room already has 4 participants.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded-lg bg-neutral-700 px-5 py-2.5 text-white hover:bg-neutral-600"
        >
          Back home
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold text-white">Can’t start the call</h1>
        <p className="mt-2 text-sm text-neutral-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-neutral-700 px-5 py-2.5 text-white hover:bg-neutral-600"
        >
          Try again
        </button>
      </div>
    );
  }

  const tileCount = peers.length + 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">{roomName}</h1>
          <p className="text-xs text-neutral-500">
            {tileCount} / 4 in call · code <span className="font-mono text-neutral-400">{slug}</span>
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        <main className="flex-1">
          {!localStream ? (
            <Loading message="Setting up your camera…" />
          ) : (
            <VideoGrid count={tileCount}>
              <VideoTile stream={localStream} name={name} isSelf muted camOff={!camOn} />
              {peers.map((p) => (
                <VideoTile key={p.socketId} stream={p.stream} name={p.name} />
              ))}
            </VideoGrid>
          )}
          {localStream && peers.length === 0 && (
            <p className="mt-4 text-center text-sm text-neutral-500">
              Waiting for others to join. Share the room link to invite them.
            </p>
          )}
        </main>

        <ChatSidebar
          open={chatOpen}
          messages={messages}
          onSend={sendMessage}
          onClose={() => setChatOpen(false)}
        />
      </div>

      <footer className="sticky bottom-3 flex justify-center">
        <ControlsBar
          micOn={micOn}
          camOn={camOn}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onLeave={handleLeave}
          onToggleChat={() => setChatOpen((v) => !v)}
          chatOpen={chatOpen}
          unread={unread}
        />
      </footer>
    </div>
  );
}
