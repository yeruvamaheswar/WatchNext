"use client";

import { useEffect, useState } from "react";
import { MicOff, PhoneOff, Captions, Sparkles } from "lucide-react";
import { VoiceOrb } from "@/components/voice-orb";
import { PosterTiles } from "@/components/poster-tiles";
import { HealthBanner } from "@/components/health-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomSession } from "@/hooks/use-room-session";
import { useRoomUi } from "@/hooks/use-room-ui";
import { useWatchNext } from "@/hooks/use-watchnext";

export default function RoomPage() {
  const { userId, guest } = useWatchNext();
  const { setActive } = useRoomUi();
  const room = useRoomSession({
    userId,
    likes: guest.likes,
    likedVibes: guest.likedVibes,
    onActiveChange: setActive,
  });

  useEffect(() => {
    return () => setActive(false);
  }, [setActive]);

  if (!room.active) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
        <div>
          <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">Room</p>
          <h1 className="mt-1 text-3xl font-semibold">Voice room</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One device hears everyone nearby. This is a live session — captions
            and replies stream while you talk, then we pick from the catalog.
          </p>
        </div>
        <HealthBanner />
        {room.micHint ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-xs text-amber-100">
            {room.micHint} You can still start and type what you want to watch.
          </div>
        ) : null}
        <VoiceOrb state="idle" />
        <Button
          type="button"
          className="h-14 rounded-full bg-violet-500 text-base text-white hover:bg-violet-400"
          onClick={() => void room.start()}
          disabled={room.orb === "connecting"}
        >
          Start session
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {room.micHint
            ? "Type your request after starting. Mic access needs HTTPS or localhost."
            : "Mic access is used only while the session is on."}
        </p>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-dvh flex-col bg-[#0a0414] px-4"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">
          {room.orb === "connecting" ? "Room starting" : "Room live"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => room.setCaptions(!room.captions)}
        >
          <Captions className="size-4" />
          {room.captions ? "Captions on" : "Captions off"}
        </Button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        <VoiceOrb state={room.orb} />
        {room.captions ? (
          <p className="min-h-10 max-w-sm text-center text-sm">
            {room.liveHeard ? (
              <span className="text-violet-100/70">
                “{room.liveHeard}
                <span className="ml-0.5 inline-block animate-pulse">▍</span>”
              </span>
            ) : room.lastHeard ? (
              <span className="text-violet-100/80">“{room.lastHeard}”</span>
            ) : room.status ? (
              <span className="text-violet-200/55">{room.status}</span>
            ) : room.orb === "connecting" ? (
              <span className="text-violet-200/55">Opening the live session…</span>
            ) : room.orb === "thinking" ? (
              <span className="text-violet-200/45">Finding a pick…</span>
            ) : room.orb === "listening" ? (
              <span className="text-violet-200/45">Listening…</span>
            ) : null}
          </p>
        ) : null}
        {room.result ? (
          <div className="w-full max-w-lg">
            <PosterTiles titles={room.result.titles} />
          </div>
        ) : null}
        {!room.micEnabled ? (
          <RoomTextComposer
            busy={room.busy}
            onSubmit={(text) => void room.submitText(text)}
          />
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-md items-center justify-center gap-4 pb-2">
        {room.micEnabled ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full"
            onClick={() => room.setMuted(!room.muted)}
            disabled={room.orb === "connecting"}
          >
            <MicOff className="size-4" />
            {room.muted ? "Unmute" : "Mute"}
          </Button>
        ) : null}
        <Button
          type="button"
          className="h-12 rounded-full bg-violet-500 text-white hover:bg-violet-400"
          onClick={() => void room.suggest()}
          disabled={room.busy || room.orb === "connecting"}
        >
          <Sparkles className="size-4" />
          Suggest
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-12 rounded-full"
          onClick={room.stop}
        >
          <PhoneOff className="size-4" />
          End
        </Button>
      </div>
    </main>
  );
}

function RoomTextComposer({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="flex w-full max-w-lg gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const text = draft.trim();
        if (!text) return;
        setDraft("");
        onSubmit(text);
      }}
    >
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="What do you want to watch?"
        className="h-12 rounded-full bg-white/5 px-4 text-sm"
        disabled={busy}
        aria-label="Type what you want to watch"
      />
      <Button
        type="submit"
        className="h-12 rounded-full bg-violet-500 text-white hover:bg-violet-400"
        disabled={busy || !draft.trim()}
      >
        Send
      </Button>
    </form>
  );
}
