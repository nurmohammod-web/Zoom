"use client";

import { useState } from "react";

interface ControlsBarProps {
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
  chatOpen: boolean;
  unread: number;
}

function iconBtn(active: boolean) {
  return `flex h-12 w-12 items-center justify-center rounded-full text-white transition ${
    active ? "bg-neutral-700 hover:bg-neutral-600" : "bg-red-600 hover:bg-red-500"
  }`;
}

export default function ControlsBar({
  micOn,
  camOn,
  onToggleMic,
  onToggleCamera,
  onLeave,
  onToggleChat,
  chatOpen,
  unread,
}: ControlsBarProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-neutral-900/80 px-4 py-3 backdrop-blur">
      <button onClick={onToggleMic} className={iconBtn(micOn)} title={micOn ? "Mute" : "Unmute"}>
        {micOn ? "🎤" : "🔇"}
      </button>
      <button onClick={onToggleCamera} className={iconBtn(camOn)} title={camOn ? "Turn camera off" : "Turn camera on"}>
        {camOn ? "📹" : "🚫"}
      </button>
      <button
        onClick={onToggleChat}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full text-white transition ${
          chatOpen ? "bg-blue-600 hover:bg-blue-500" : "bg-neutral-700 hover:bg-neutral-600"
        }`}
        title="Chat"
      >
        💬
        {unread > 0 && !chatOpen && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
            {unread}
          </span>
        )}
      </button>
      <button
        onClick={copyLink}
        className="flex h-12 items-center gap-2 rounded-full bg-neutral-700 px-4 text-sm font-medium text-white transition hover:bg-neutral-600"
        title="Copy room link"
      >
        {copied ? "✅ Copied" : "🔗 Copy link"}
      </button>
      <button
        onClick={onLeave}
        className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-500"
      >
        📞 Leave
      </button>
    </div>
  );
}
