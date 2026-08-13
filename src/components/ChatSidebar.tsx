"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../hooks/useWebRTC";

interface ChatSidebarProps {
  open: boolean;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}

export default function ChatSidebar({ open, messages, onSend, onClose }: ChatSidebarProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(draft);
    setDraft("");
  };

  return (
    <aside className="flex w-full flex-col rounded-2xl bg-neutral-900 ring-1 ring-white/10 md:w-80">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Chat</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-white" aria-label="Close chat">
          ✕
        </button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ maxHeight: "60vh" }}>
        {messages.length === 0 && (
          <p className="text-center text-xs text-neutral-500">No messages yet.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.self ? "items-end" : "items-start"}`}>
            <span className="text-[11px] text-neutral-500">{m.self ? "You" : m.name}</span>
            <span
              className={`mt-0.5 max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                m.self ? "bg-blue-600 text-white" : "bg-neutral-700 text-neutral-100"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none ring-1 ring-white/10 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500"
        >
          Send
        </button>
      </form>
    </aside>
  );
}
