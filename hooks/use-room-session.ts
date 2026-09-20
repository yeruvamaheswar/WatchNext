"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { heuristicIntent } from "@/lib/intent-heuristic";
import { getUserMediaFn, microphoneBlockReason } from "@/lib/microphone";
import { RECOMMEND_TOOL_NAME } from "@/lib/realtime-constants";
import { connectRealtime, type RealtimeEvent, type RealtimeHandle } from "@/lib/realtime-webrtc";
import type { ExtractedIntent, GuestLike, RecommendResult } from "@/lib/types";

export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

type Options = {
  userId: string;
  likes: GuestLike[];
  likedVibes: string[];
  dislikedVibes?: string[];
  excludeTmdbIds?: number[];
  onActiveChange?: (active: boolean) => void;
};

type RecommendToolArgs = {
  queryText?: string;
  mediaType?: "movie" | "tv" | "any";
  genres?: string[];
  moods?: string[];
  people?: string[];
  titles?: string[];
};

export function useRoomSession({ userId, likes, likedVibes, dislikedVibes, excludeTmdbIds, onActiveChange }: Options) {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [orb, setOrb] = useState<OrbState>("idle");
  const [captions, setCaptions] = useState(true);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [lastHeard, setLastHeard] = useState("");
  const [liveHeard, setLiveHeard] = useState("");
  const [extract, setExtract] = useState<ExtractedIntent | null>(null);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setMicHint(microphoneBlockReason());
  }, []);

  const streamRef = useRef<MediaStream | null>(null);
  const handleRef = useRef<RealtimeHandle | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const suggestedIdsRef = useRef<number[]>([]);
  const liveBufferRef = useRef("");
  const likesRef = useRef(likes);
  const vibesRef = useRef(likedVibes);
  const dislikedVibesRef = useRef(dislikedVibes ?? []);
  const excludeRef = useRef(excludeTmdbIds ?? []);
  const userIdRef = useRef(userId);
  const startGenRef = useRef(0);
  const secretRef = useRef<{ value: string; expiresAt: number } | null>(null);

  useEffect(() => {
    likesRef.current = likes;
    vibesRef.current = likedVibes;
    dislikedVibesRef.current = dislikedVibes ?? [];
    excludeRef.current = excludeTmdbIds ?? [];
    userIdRef.current = userId;
  }, [dislikedVibes, excludeTmdbIds, likedVibes, likes, userId]);

  const beginSession = useCallback(
    (withMic: boolean, nextOrb: OrbState = withMic ? "listening" : "idle") => {
      activeRef.current = true;
      setActive(true);
      setMicEnabled(withMic);
      setOrb(nextOrb);
      onActiveChange?.(true);
    },
    [onActiveChange]
  );

  const fetchSessionSecret = useCallback(async () => {
    const res = await fetch("/api/realtime/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userIdRef.current }),
    });
    const json = await res.json();
    if (!res.ok || !json.value) {
      throw new Error(json.error || "Could not start a Realtime session.");
    }
    const secret = {
      value: String(json.value),
      expiresAt: Number(json.expiresAt) || Date.now() / 1000 + 600,
    };
    secretRef.current = secret;
    return secret;
  }, []);

  const takeSessionSecret = useCallback(async () => {
    const cached = secretRef.current;
    if (cached && cached.expiresAt * 1000 > Date.now() + 20_000) {
      return cached;
    }
    return fetchSessionSecret();
  }, [fetchSessionSecret]);

  const stopCapture = useCallback(() => {
    handleRef.current?.close();
    handleRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    liveBufferRef.current = "";
    setLiveHeard("");
  }, []);

  const sendUserText = useCallback((text: string) => {
    const handle = handleRef.current;
    if (!handle) return false;
    handle.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    handle.send({ type: "response.create" });
    return true;
  }, []);

  const runRecommendTool = useCallback(async (rawArgs: string, callId: string) => {
    setBusy(true);
    setOrb("thinking");
    let parsed: RecommendToolArgs = {};
    try {
      parsed = JSON.parse(rawArgs) as RecommendToolArgs;
    } catch {
      parsed = {};
    }
    const queryText = parsed.queryText?.trim() || liveBufferRef.current || lastHeard || "just pick something";
    const intent = heuristicIntent(queryText);
    if (parsed.genres?.length) intent.genres = parsed.genres;
    if (parsed.moods?.length) intent.moods = parsed.moods;
    if (parsed.people?.length) intent.people = parsed.people;
    if (parsed.titles?.length) intent.titles = parsed.titles;
    if (parsed.mediaType) intent.mediaType = parsed.mediaType;
    intent.watchIntent = true;
    intent.searchQuery = queryText;
    setExtract(intent);

    try {
      const rec = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdRef.current,
          likes: likesRef.current,
          likedVibes: vibesRef.current,
          dislikedVibes: dislikedVibesRef.current,
          extract: intent,
          queryText,
          excludeTmdbIds: excludeRef.current,
          sessionExcludeIds: suggestedIdsRef.current,
        }),
      });
      const data = await rec.json();
      if (!rec.ok) throw new Error(data.error || "Recommend failed.");
      const next = data as RecommendResult;
      setResult(next);
      suggestedIdsRef.current = [
        ...suggestedIdsRef.current,
        ...next.titles.map((title) => title.tmdbId),
      ];
      handleRef.current?.send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({
            spokenPitch: next.spokenPitch,
            titles: next.titles.map((title) => ({
              name: title.name,
              year: title.year,
              reason: title.reason,
            })),
          }),
        },
      });
      handleRef.current?.send({ type: "response.create" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not suggest.";
      toast.error(message);
      handleRef.current?.send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ error: message }),
        },
      });
      handleRef.current?.send({ type: "response.create" });
      setBusy(false);
      setOrb(activeRef.current ? "listening" : "idle");
    }
  }, [lastHeard]);

  const onRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          liveBufferRef.current = "";
          setLiveHeard("");
          setOrb("listening");
          break;
        case "response.created":
          setOrb("thinking");
          break;
        case "conversation.item.input_audio_transcription.delta": {
          const delta = typeof event.delta === "string" ? event.delta : "";
          if (!delta) break;
          liveBufferRef.current += delta;
          setLiveHeard(liveBufferRef.current.trim());
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const text = String(event.transcript ?? "").trim();
          liveBufferRef.current = "";
          setLiveHeard("");
          if (!text) break;
          setLastHeard(text);
          setTranscript((prev) => [...prev, text].slice(-24));
          break;
        }
        case "response.function_call_arguments.done":
          if (event.name === RECOMMEND_TOOL_NAME && typeof event.call_id === "string") {
            void runRecommendTool(String(event.arguments ?? "{}"), event.call_id);
          }
          break;
        case "response.output_audio_transcript.delta":
        case "response.output_audio.delta":
          setOrb("speaking");
          break;
        case "response.done":
          setBusy(false);
          if (activeRef.current) setOrb("listening");
          break;
        case "error": {
          const detail = event.error as { message?: string; code?: string } | undefined;
          const code = detail?.code ?? "";
          if (code.includes("cancel") || code === "response_cancel") break;
          if (detail?.message) toast.error(detail.message);
          break;
        }
        default:
          break;
      }
    },
    [runRecommendTool]
  );

  const start = useCallback(async () => {
    const gen = ++startGenRef.current;
    setStatus("Opening microphone…");
    beginSession(true, "connecting");

    try {
      const getUserMedia = getUserMediaFn();
      if (!getUserMedia) {
        const reason = microphoneBlockReason();
        toast.error(reason ?? "Microphone is not available in this browser.");
        setStatus(null);
        beginSession(false);
        return;
      }

      const [stream, secret] = await Promise.all([
        getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
        }),
        takeSessionSecret(),
      ]);
      if (gen !== startGenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setStatus("Connecting…");

      const audio = audioElRef.current ?? new Audio();
      audioElRef.current = audio;
      handleRef.current = await connectRealtime({
        clientSecret: secret.value,
        stream,
        audioEl: audio,
        onEvent: onRealtimeEvent,
      });
      if (gen !== startGenRef.current) {
        stopCapture();
        return;
      }
      handleRef.current.setMuted(false);
      setMicEnabled(true);
      setOrb("listening");
      setStatus(null);
    } catch (err) {
      if (gen !== startGenRef.current) return;
      stopCapture();
      const blocked = microphoneBlockReason();
      toast.error(
        blocked ??
          (err instanceof Error ? err.message : "Could not start a live Room session.")
      );
      setStatus(null);
      beginSession(false);
    }
  }, [beginSession, onRealtimeEvent, stopCapture, takeSessionSecret]);

  const stop = useCallback(() => {
    startGenRef.current += 1;
    activeRef.current = false;
    stopCapture();
    setActive(false);
    setMicEnabled(false);
    setMuted(false);
    setStatus(null);
    setOrb("idle");
    onActiveChange?.(false);
  }, [onActiveChange, stopCapture]);

  const submitText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setLastHeard(text);
      setTranscript((prev) => [...prev, text].slice(-24));
      setOrb("thinking");
      if (sendUserText(text)) return;
      const intent = heuristicIntent(text);
      setExtract(intent);
      setBusy(true);
      try {
        const rec = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            likes,
            likedVibes,
            dislikedVibes,
            extract: intent,
            queryText: text,
            excludeTmdbIds: excludeRef.current,
            sessionExcludeIds: suggestedIdsRef.current,
          }),
        });
        const data = await rec.json();
        if (!rec.ok) throw new Error(data.error || "Recommend failed.");
        const next = data as RecommendResult;
        setResult(next);
        suggestedIdsRef.current = [
          ...suggestedIdsRef.current,
          ...next.titles.map((title) => title.tmdbId),
        ];
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not suggest.");
      } finally {
        setBusy(false);
        setOrb(activeRef.current ? "listening" : "idle");
      }
    },
    [dislikedVibes, likedVibes, likes, sendUserText, userId]
  );

  const suggest = useCallback(() => {
    setOrb("thinking");
    if (sendUserText("Suggest something to watch now based on what we said.")) return;
    void submitText(lastHeard || "just pick something");
  }, [lastHeard, sendUserText, submitText]);

  useEffect(() => {
    handleRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    void fetchSessionSecret().catch(() => {});
  }, [fetchSessionSecret]);

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
    liveHeard,
    extract,
    result,
    busy,
    micEnabled,
    micHint,
    status,
    start,
    stop,
    submitText,
    suggest,
  };
}
