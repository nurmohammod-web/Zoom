"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL ?? "http://localhost:4000";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export type ConnStatus = "idle" | "connecting" | "ready" | "full" | "error";

export interface RemotePeer {
  socketId: string;
  name: string;
  stream: MediaStream | null;
}

export interface ChatMessage {
  from: string;
  name: string;
  text: string;
  ts: number;
  self?: boolean;
}

interface UseWebRTC {
  status: ConnStatus;
  error: string | null;
  localStream: MediaStream | null;
  peers: RemotePeer[];
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  leave: () => void;
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  meId: string | null;
}

// Mesh WebRTC for small groups (server enforces max 4).
// Initiator model to avoid glare: members already in the room create the
// offer to each newcomer; the newcomer only answers.
export function useWebRTC(roomId: string, name: string, active: boolean): UseWebRTC {
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE candidates that arrive before the remote description is set.
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const namesRef = useRef<Map<string, string>>(new Map());

  const upsertPeer = useCallback((socketId: string, patch: Partial<RemotePeer>) => {
    setPeers((prev) => {
      const idx = prev.findIndex((p) => p.socketId === socketId);
      if (idx === -1) {
        return [
          ...prev,
          {
            socketId,
            name: namesRef.current.get(socketId) ?? "Guest",
            stream: null,
            ...patch,
          },
        ];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const removePeer = useCallback((socketId: string) => {
    const pc = pcsRef.current.get(socketId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      pcsRef.current.delete(socketId);
    }
    pendingIce.current.delete(socketId);
    namesRef.current.delete(socketId);
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  const createPeerConnection = useCallback(
    (socketId: string): RTCPeerConnection => {
      const existing = pcsRef.current.get(socketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcsRef.current.set(socketId, pc);

      const local = localStreamRef.current;
      if (local) {
        for (const track of local.getTracks()) {
          pc.addTrack(track, local);
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current?.emit("ice-candidate", {
            to: socketId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (e) => {
        upsertPeer(socketId, { stream: e.streams[0] ?? null });
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          // Leave cleanup to the explicit peer-left signal; ignore transient drops.
        }
      };

      upsertPeer(socketId, {});
      return pc;
    },
    [upsertPeer],
  );

  const flushIce = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
    const queued = pendingIce.current.get(socketId);
    if (!queued) return;
    for (const cand of queued) {
      try {
        await pc.addIceCandidate(cand);
      } catch {
        /* ignore malformed late candidate */
      }
    }
    pendingIce.current.delete(socketId);
  }, []);

  useEffect(() => {
    if (!active || !roomId || !name) return;

    let cancelled = false;
    setStatus("connecting");

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? `Could not access camera/mic: ${err.message}`
            : "Could not access camera/mic",
        );
        setStatus("error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const socket = io(SIGNALING_URL, { transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        setMeId(socket.id ?? null);
        socket.emit("join-room", { roomId, name });
      });

      socket.on("room-full", () => {
        setStatus("full");
      });

      // We are the newcomer: create a connection to each existing peer and
      // wait for their offer (they initiate).
      socket.on(
        "existing-peers",
        ({ peers: list }: { peers: { socketId: string; name: string }[] }) => {
          for (const p of list) {
            namesRef.current.set(p.socketId, p.name);
            createPeerConnection(p.socketId);
            upsertPeer(p.socketId, { name: p.name });
          }
          setStatus("ready");
        },
      );

      // An existing member: a newcomer arrived, so we initiate the offer.
      socket.on(
        "peer-joined",
        async ({ socketId, name: peerName }: { socketId: string; name: string }) => {
          namesRef.current.set(socketId, peerName);
          const pc = createPeerConnection(socketId);
          upsertPeer(socketId, { name: peerName });
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", { to: socketId, sdp: offer });
          } catch {
            /* ignore */
          }
          setStatus("ready");
        },
      );

      socket.on(
        "offer",
        async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
          const pc = createPeerConnection(from);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushIce(from, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer", { to: from, sdp: answer });
          } catch {
            /* ignore */
          }
        },
      );

      socket.on(
        "answer",
        async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
          const pc = pcsRef.current.get(from);
          if (!pc) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await flushIce(from, pc);
          } catch {
            /* ignore */
          }
        },
      );

      socket.on(
        "ice-candidate",
        async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
          const pc = pcsRef.current.get(from);
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(candidate);
            } catch {
              /* ignore */
            }
          } else {
            const q = pendingIce.current.get(from) ?? [];
            q.push(candidate);
            pendingIce.current.set(from, q);
          }
        },
      );

      socket.on("peer-left", ({ socketId }: { socketId: string }) => {
        removePeer(socketId);
      });

      socket.on("chat-message", (m: ChatMessage) => {
        setMessages((prev) => [...prev, { ...m, self: m.from === socket.id }]);
      });
    }

    start();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      pcsRef.current.forEach((pc) => {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      });
      pcsRef.current.clear();
      pendingIce.current.clear();
      namesRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setPeers([]);
      setLocalStream(null);
      setStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, roomId, name]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !stream.getAudioTracks()[0]?.enabled;
    stream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setMicOn(enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !stream.getVideoTracks()[0]?.enabled;
    stream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setCamOn(enabled);
  }, []);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socketRef.current?.emit("chat-message", { text: trimmed });
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setPeers([]);
    setStatus("idle");
  }, []);

  return {
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
    meId,
  };
}
