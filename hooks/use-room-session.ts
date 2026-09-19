"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { floatToWav } from "@/lib/wav";
import type { ExtractedIntent, GuestLike, RecommendResult } from "@/lib/types";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

type Options = {
  userId: string;
  likes: GuestLike[];
  likedVibes: string[];
  onActiveChange?: (active: boolean) => void;
};

const WATCH_HINT =
  /\b(watch|movie|show|film|series|recommend|suggest|tonight|something)\b/i;

export function useRoomSession({ userId, likes, likedVibes, onActiveChange }: Options) {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [orb, setOrb] = useState<OrbState>("idle");
  const [captions, setCaptions] = useState(true);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [lastHeard, setLastHeard] = useState("");
  const [extract, setExtract] = useState<ExtractedIntent | null>(null);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [busy, setBusy] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);
  const chunksRef = useRef<Float32Array[]>([]);
  const lastVoiceRef = useRef(0);
  const speechStartedRef = useRef(0);
  const suggestedIdsRef = useRef<number[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const transcriptRef = useRef<string[]>([]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const unlockAudio = useCallback(async () => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = audioCtxRef.current ?? new Ctx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    if (!audioElRef.current) {
      audioElRef.current = new Audio();
    }
  }, []);

  const stopCapture = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    speakingRef.current = false;
    chunksRef.current = [];
  }, []);

  const playTts = useCallback(async (text: string) => {
    setOrb("speaking");
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "TTS failed.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioElRef.current = audio;
    await audio.play().catch(() => {});
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
    });
    URL.revokeObjectURL(url);
  }, []);

  const runSuggest = useCallback(
    async (forcedExtract?: ExtractedIntent | null, queryText?: string) => {
      setBusy(true);
      setOrb("thinking");
      try {
        const rec = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            likes,
            likedVibes,
            extract: forcedExtract ?? extract,
            queryText:
              queryText ||
              transcriptRef.current.slice(-6).join(" ") ||
              "just pick something",
            sessionExcludeIds: suggestedIdsRef.current,
          }),
        });
        const data = await rec.json();
        if (!rec.ok) {
          throw new Error(data.error || "Recommend failed.");
        }
        const next = data as RecommendResult;
        setResult(next);
        suggestedIdsRef.current = [
          ...suggestedIdsRef.current,
          ...next.titles.map((t) => t.tmdbId),
        ];
        await playTts(next.spokenPitch);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not suggest.");
      } finally {
        setBusy(false);
        setOrb(activeRef.current ? "listening" : "idle");
      }
    },
    [extract, likedVibes, likes, playTts, userId]
  );

  const handleUtterance = useCallback(
    async (wav: Blob) => {
      setOrb("thinking");
      const form = new FormData();
      form.set("file", wav, "utterance.wav");
      const stt = await fetch("/api/transcribe", { method: "POST", body: form });
      const sttJson = await stt.json();
      if (!stt.ok) {
        toast.error(sttJson.error || "Transcription failed.");
        setOrb("listening");
        return;
      }
      const text = String(sttJson.text ?? "").trim();
      if (!text) {
        setOrb("listening");
        return;
      }
      setLastHeard(text);
      setTranscript((prev) => [...prev, text].slice(-24));

      const prior = transcriptRef.current.join(" ");
      const extracted = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, prior }),
      });
      const extractedJson = await extracted.json();
      if (!extracted.ok) {
        toast.error(extractedJson.error || "Extract failed.");
        setOrb("listening");
        return;
      }
      const intent = extractedJson.extract as ExtractedIntent;
      setExtract(intent);

      const entityCount =
        intent.titles.length +
        intent.people.length +
        intent.genres.length +
        intent.moods.length;
      const shouldSuggest =
        intent.watchIntent || entityCount >= 2 || WATCH_HINT.test(text);
      if (shouldSuggest) {
        await runSuggest(intent, intent.searchQuery || text);
      } else {
        setOrb("listening");
      }
    },
    [runSuggest]
  );

  const start = useCallback(async () => {
    try {
      await unlockAudio();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const ctx = audioCtxRef.current!;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      const silenceMs = 900;
      const speechThreshold = 0.018;
      const silenceThreshold = 0.012;

      processor.onaudioprocess = (event) => {
        if (!activeRef.current || mutedRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        const now = performance.now();
        if (rms > speechThreshold) {
          if (!speakingRef.current) {
            speakingRef.current = true;
            speechStartedRef.current = now;
            chunksRef.current = [];
            setOrb("listening");
          }
          lastVoiceRef.current = now;
          chunksRef.current.push(new Float32Array(input));
        } else if (speakingRef.current) {
          chunksRef.current.push(new Float32Array(input));
          if (now - lastVoiceRef.current > silenceMs) {
            speakingRef.current = false;
            const duration = now - speechStartedRef.current;
            const frames = chunksRef.current;
            chunksRef.current = [];
            if (duration > 400 && frames.length) {
              const length = frames.reduce((n, f) => n + f.length, 0);
              const merged = new Float32Array(length);
              let offset = 0;
              for (const f of frames) {
                merged.set(f, offset);
                offset += f.length;
              }
              const wav = floatToWav(merged, ctx.sampleRate);
              void handleUtterance(wav);
            }
          }
        } else if (rms > silenceThreshold) {
          lastVoiceRef.current = now;
        }
      };

      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);
      activeRef.current = true;
      setActive(true);
      setOrb("listening");
      onActiveChange?.(true);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Microphone permission is required for Room."
      );
    }
  }, [handleUtterance, onActiveChange, unlockAudio]);

  const stop = useCallback(() => {
    activeRef.current = false;
    stopCapture();
    audioElRef.current?.pause();
    setActive(false);
    setOrb("idle");
    onActiveChange?.(false);
  }, [onActiveChange, stopCapture]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopCapture();
    };
  }, [stopCapture]);

  return {
    active,
    muted,
    setMuted,
    orb,
    captions,
    setCaptions,
    transcript,
    lastHeard,
    extract,
    result,
    busy,
    start,
    stop,
    suggest: () => runSuggest(extract),
  };
}
