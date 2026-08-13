"use client";

import { useEffect, useRef } from "react";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  muted?: boolean; // mute audio for the local tile to avoid echo
  isSelf?: boolean;
  camOff?: boolean;
}

export default function VideoTile({ stream, name, muted, isSelf, camOff }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-800 ring-1 ring-white/10">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${camOff ? "hidden" : ""} ${
          isSelf ? "-scale-x-100" : ""
        }`}
      />
      {(camOff || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-600 text-2xl font-semibold text-white">
            {initial}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
        {name}
        {isSelf && <span className="text-white/60">(you)</span>}
      </div>
    </div>
  );
}
