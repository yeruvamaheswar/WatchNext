"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getUserMediaFn, microphoneBlockReason } from "@/lib/microphone";
import {
  GROUP_MAX_LISTEN_MS,
  GROUP_SILENCE_MS,
  createGroupVadState,
  tickGroupVad,
} from "@/lib/group-vad";
import type { OrbState } from "@/hooks/use-room-session";
import type {
  DiarizedSegment,
  GuestLike,
  RecommendResult,
} from "@/lib/types";

type Options = {
  userId: string;
  likes: GuestLike[];
  likedVibes: string[];
  onActiveChange?: (active: boolean) => void;
};

export type GroupListenResult = RecommendResult & {
  segments: DiarizedSegment[];
  speakerNotes: Record<string, string>;
  labeledTranscript: string;
};

export function useGroupListen({
  userId,
  likes,
  likedVibes,
  onActiveChange,
}: Options) {
  const [active, setActive] = useState(false);
  const [orb, setOrb] = useState<OrbState>("idle");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<GroupListenResult | null>(null);
  const [segments, setSegments] = useState<DiarizedSegment[]>([]);
  const [micHint, setMicHint] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [silenceMs, setSilenceMs] = useState(0);
  const [heardSpeech, setHeardSpeech] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const vadRef = useRef(createGroupVadState());
  const startedAtRef = useRef(0);
  const suggestingRef = useRef(false);
  const activeRef = useRef(false);
  const likesRef = useRef(likes);
  const vibesRef = useRef(likedVibes);
  const userIdRef = useRef(userId);
  const suggestedIdsRef = useRef<number[]>([]);

  useEffect(() => {
    setMicHint(microphoneBlockReason());
  }, []);

  useEffect(() => {
    likesRef.current = likes;
    vibesRef.current = likedVibes;
    userIdRef.current = userId;
  }, [likes, likedVibes, userId]);

  const teardownCapture = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const endSession = useCallback(() => {
    activeRef.current = false;
    suggestingRef.current = false;
    teardownCapture();
    setActive(false);
    setOrb("idle");
    setBusy(false);
    setStatus(null);
    setElapsedMs(0);
    setSilenceMs(0);
    setHeardSpeech(false);
    onActiveChange?.(false);
  }, [onActiveChange, teardownCapture]);

  const stop = useCallback(() => {
    endSession();
    setResult(null);
    setSegments([]);
    suggestedIdsRef.current = [];
  }, [endSession]);

  const runPipeline = useCallback(
    async (blob: Blob) => {
      if (blob.size < 800) {
        toast.error("Discussion was too short. Talk a bit, then Suggest.");
        setOrb("listening");
        setBusy(false);
        setStatus("Listening…");
        suggestingRef.current = false;
        return;
      }

      setOrb("thinking");
      setBusy(true);
      setStatus("Labeling speakers…");

      try {
        const form = new FormData();
        form.append(
          "file",
          blob,
          blob.type.includes("wav") ? "discussion.wav" : "discussion.webm"
        );
        const diarizeRes = await fetch("/api/transcribe/diarize", {
          method: "POST",
          body: form,
        });
        const diarizeJson = (await diarizeRes.json()) as {
          text?: string;
          segments?: DiarizedSegment[];
          error?: string;
          hint?: string;
        };
        if (!diarizeRes.ok) {
          throw new Error(diarizeJson.hint || diarizeJson.error || "Diarize failed");
        }
        const nextSegments = diarizeJson.segments ?? [];
        setSegments(nextSegments);
        if (nextSegments.length === 0) {
          throw new Error("No speech detected. Talk a bit louder, then Suggest.");
        }

        setStatus("Picking for the group…");
        const recRes = await fetch("/api/group/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: nextSegments,
            userId: userIdRef.current,
            likes: likesRef.current,
            likedVibes: vibesRef.current,
            sessionExcludeIds: suggestedIdsRef.current,
          }),
        });
        const recJson = (await recRes.json()) as GroupListenResult & {
          error?: string;
          hint?: string;
        };
        if (!recRes.ok) {
          throw new Error(recJson.hint || recJson.error || "Recommend failed");
        }

        for (const t of recJson.titles ?? []) {
          if (typeof t.tmdbId === "number") suggestedIdsRef.current.push(t.tmdbId);
        }
        setResult(recJson);
        setSegments(recJson.segments ?? nextSegments);
        setOrb("idle");
        setStatus(null);
        setBusy(false);
        suggestingRef.current = false;
        teardownCapture();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Group suggest failed";
        toast.error(message);
        setOrb("listening");
        setBusy(false);
        setStatus("Listening…");
        suggestingRef.current = false;
      }
    },
    [teardownCapture]
  );

  const finishAndSuggest = useCallback(async () => {
    if (suggestingRef.current || !activeRef.current) return;
    suggestingRef.current = true;

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      toast.error("Nothing recorded yet.");
      suggestingRef.current = false;
      return;
    }

    setBusy(true);
    setStatus("Wrapping up…");
    setOrb("thinking");

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    const type = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    recorderRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    await runPipeline(blob);
  }, [runPipeline]);

  const startVadLoop = useCallback(() => {
    const tick = () => {
      if (!activeRef.current || suggestingRef.current) return;
      const analyser = analyserRef.current;
      if (!analyser) return;
      const now = performance.now();
      const elapsed = now - startedAtRef.current;
      setElapsedMs(elapsed);

      if (elapsed >= GROUP_MAX_LISTEN_MS) {
        toast.message("Max listen time — suggesting for the group.");
        void finishAndSuggest();
        return;
      }

      const vad = tickGroupVad(vadRef.current, analyser, now, elapsed);
      setHeardSpeech(vadRef.current.heardSpeech);
      setSilenceMs(vad.silenceMs);
      if (vad.speaking) setOrb("listening");
      else if (vadRef.current.heardSpeech && vad.silenceMs > 0) {
        setStatus(
          `Quiet… suggesting in ${Math.max(1, Math.ceil((GROUP_SILENCE_MS - vad.silenceMs) / 1000))}s`
        );
      } else {
        setStatus("Listening…");
      }

      if (vad.shouldAutoSuggest) {
        void finishAndSuggest();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [finishAndSuggest]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    setResult(null);
    setSegments([]);
    setBusy(false);
    setStatus("Listening…");
    setElapsedMs(0);
    setSilenceMs(0);
    setHeardSpeech(false);
    vadRef.current = createGroupVadState();
    chunksRef.current = [];
    suggestingRef.current = false;

    const getUserMedia = getUserMediaFn();
    if (!getUserMedia) {
      toast.error(microphoneBlockReason() || "Microphone unavailable.");
      return;
    }

    setOrb("connecting");
    try {
      const stream = await getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      streamRef.current = stream;

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(1000);

      activeRef.current = true;
      startedAtRef.current = performance.now();
      setActive(true);
      setOrb("listening");
      onActiveChange?.(true);
      startVadLoop();
    } catch (err) {
      teardownCapture();
      setOrb("idle");
      const message =
        err instanceof Error ? err.message : "Could not start group listen.";
      toast.error(message);
    }
  }, [onActiveChange, startVadLoop, teardownCapture]);

  const suggest = useCallback(() => {
    if (!activeRef.current) return;
    if (!vadRef.current.heardSpeech && chunksRef.current.length === 0) {
      toast.error("Wait until someone talks, then Suggest.");
      return;
    }
    void finishAndSuggest();
  }, [finishAndSuggest]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      teardownCapture();
    };
  }, [teardownCapture]);

  return {
    active,
    orb,
    busy,
    status,
    result,
    segments,
    micHint,
    elapsedMs,
    silenceMs,
    heardSpeech,
    start,
    suggest,
    stop,
  };
}
