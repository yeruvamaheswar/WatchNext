"use client";

import { useEffect } from "react";
import { MicOff, PhoneOff, Captions, Sparkles } from "lucide-react";
import { VoiceOrb } from "@/components/voice-orb";
import { PosterTiles } from "@/components/poster-tiles";
import { HealthBanner } from "@/components/health-banner";
import { Button } from "@/components/ui/button";
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
            One device hears everyone nearby. This is a session — not background
            recording. We transcribe after you pause, then suggest only when you
            want a pick.
          </p>
        </div>
        <HealthBanner />
        <VoiceOrb state="idle" />
        <Button
          type="button"
          className="h-14 rounded-full bg-violet-500 text-base text-white hover:bg-violet-400"
          onClick={() => void room.start()}
        >
          Start session
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Mic access is used only while the session is on.
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
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">Room live</p>
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
        {room.captions && room.lastHeard ? (
          <p className="max-w-sm text-center text-sm text-violet-100/80">
            “{room.lastHeard}”
          </p>
        ) : null}
        {room.result ? (
          <div className="w-full max-w-lg">
            <PosterTiles titles={room.result.titles} />
          </div>
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-md items-center justify-center gap-4 pb-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-full"
          onClick={() => room.setMuted(!room.muted)}
        >
          <MicOff className="size-4" />
          {room.muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          type="button"
          className="h-12 rounded-full bg-violet-500 text-white hover:bg-violet-400"
          onClick={() => void room.suggest()}
          disabled={room.busy}
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
