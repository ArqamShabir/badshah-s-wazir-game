import { useEffect, useRef, useState } from "react";

type StreamMap = Record<string, MediaStream>;

const iceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302"] },
];

// selfId must be the same as player.uid used in GameRoom/PlayerTile
export const useVideoChat = (
  roomId: string | null,
  selfId: string | undefined
) => {
  const [streams, setStreams] = useState<StreamMap>({});
  const [error, setError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!roomId || !selfId) return;

    let isMounted = true;

    const teardownPeer = (peerId: string) => {
      const pc = peersRef.current[peerId];
      if (pc) {
        pc.close();
        delete peersRef.current[peerId];
      }
      setStreams((prev) => {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    };

    const attachLocalTracks = (pc: RTCPeerConnection) => {
      if (!localStreamRef.current) return;
      const senders = pc.getSenders();
      localStreamRef.current.getTracks().forEach((track) => {
        const alreadySending = senders.some((s) => s.track && s.track.id === track.id);
        if (!alreadySending) {
          pc.addTrack(track, localStreamRef.current as MediaStream);
        }
      });
    };

    const createPeer = (peerId: string) => {
      // Reuse existing pc if present
      if (peersRef.current[peerId]) {
        return peersRef.current[peerId];
      }

      const pc = new RTCPeerConnection({ iceServers });
      peersRef.current[peerId] = pc;

      attachLocalTracks(pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.send(
            JSON.stringify({
              type: "ice",
              room: roomId,
              to: peerId,
              from: selfId,
              payload: event.candidate,
            })
          );
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream || peerId === selfId) return; // ignore any self-looped tracks
        setStreams((prev) => ({ ...prev, [peerId]: stream }));
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "disconnected"
        ) {
          teardownPeer(peerId);
        }
      };

      return pc;
    };

    const createOffer = async (peerId: string) => {
      const pc = createPeer(peerId);
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.send(
        JSON.stringify({
          type: "offer",
          room: roomId,
          to: peerId,
          from: selfId,
          payload: offer,
        })
      );
    };

    const handleOffer = async (
      peerId: string,
      offer: RTCSessionDescriptionInit
    ) => {
      const pc = createPeer(peerId);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.send(
        JSON.stringify({
          type: "answer",
          room: roomId,
          to: peerId,
          from: selfId,
          payload: answer,
        })
      );
    };

    const handleAnswer = async (
      peerId: string,
      answer: RTCSessionDescriptionInit
    ) => {
      const pc = peersRef.current[peerId];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleIceCandidate = async (
      peerId: string,
      candidate: RTCIceCandidateInit
    ) => {
      const pc = peersRef.current[peerId];
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    };

    const scheduleReconnect = () => {
      if (!isMounted) return;
      if (reconnectTimeoutRef.current) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 8000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        initSocket();
      }, delay);
    };

    const initSocket = () => {
      if (!isMounted) return;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

      // Default to same host /signal via ws or wss to avoid hardcoded localhost in production
      const fallbackHost = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/signal`;
      let url = (import.meta.env.VITE_SIGNALING_URL || fallbackHost).trim();
      if (location.protocol === "https:" && url.startsWith("ws://")) {
        // Auto-upgrade to wss when served over https to avoid mixed-content blocking
        url = url.replace(/^ws:\/\//, "wss://");
      }

      socketRef.current = new WebSocket(url);

      socketRef.current.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setError(null);
        socketRef.current?.send(
          JSON.stringify({ type: "join", room: roomId, from: selfId })
        );
      };

      socketRef.current.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        const { type, from, payload, room } = msg || {};

        // Ignore messages from ourselves
        if (from === selfId) return;
        // Ignore other rooms
        if (room && room !== roomId) return;

        switch (type) {
          case "peers": {
            const peers: string[] = payload || [];
            peers
              .filter((peerId) => peerId && peerId !== selfId)
              .forEach((peerId) => {
                void createOffer(peerId);
              });
            break;
          }
          case "peer-join":
            // Existing peers don't need to act; joiner gets "peers" and calls createOffer
            break;
          case "offer":
            if (from && payload) await handleOffer(from, payload);
            break;
          case "answer":
            if (from && payload) await handleAnswer(from, payload);
            break;
          case "ice":
            if (from && payload) await handleIceCandidate(from, payload);
            break;
          case "peer-leave":
            if (from) teardownPeer(from);
            break;
          default:
            break;
        }
      };

      socketRef.current.onclose = () => {
        Object.keys(peersRef.current).forEach(teardownPeer);
        setError((prev) => prev || "Signaling disconnected");
        socketRef.current = null;
        scheduleReconnect();
      };

      socketRef.current.onerror = () => {
        setError("Cannot reach signaling server");
      };
    };

    const setupLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setIsAudioEnabled(stream.getAudioTracks().some((t) => t.enabled !== false));
        setIsVideoEnabled(stream.getVideoTracks().some((t) => t.enabled !== false));
        setStreams((prev) => ({ ...prev, [selfId]: stream }));
        // Attach tracks to any peers that may already exist
        Object.values(peersRef.current).forEach((pc) => {
          if (pc) {
            stream.getTracks().forEach((track) => {
              const alreadySending = pc.getSenders().some((s) => s.track && s.track.id === track.id);
              if (!alreadySending) {
                pc.addTrack(track, stream);
              }
            });
          }
        });
        initSocket();
      } catch (err: any) {
        console.error("Media capture failed", err);
        setError(
          "Camera/Mic unavailable. Allow permissions or use HTTPS/localhost."
        );
      }
    };

    setupLocalStream();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !socketRef.current) {
        reconnectAttemptsRef.current = 0;
        initSocket();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      Object.keys(peersRef.current).forEach(teardownPeer);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      socketRef.current?.close();
      socketRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [roomId, selfId]);

  const toggleAudio = (nextState?: boolean) => {
    const enabled = nextState ?? !isAudioEnabled;
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach((t) => {
      t.enabled = enabled;
    });
    setIsAudioEnabled(enabled);
    setStreams((prev) => ({ ...prev }));
  };

  const toggleVideo = (nextState?: boolean) => {
    const enabled = nextState ?? !isVideoEnabled;
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    tracks.forEach((t) => {
      t.enabled = enabled;
    });
    setIsVideoEnabled(enabled);
    setStreams((prev) => ({ ...prev }));
  };

  return { streams, error, toggleAudio, toggleVideo, isAudioEnabled, isVideoEnabled };
};
