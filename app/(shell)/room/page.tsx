"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MicOff, PhoneOff, Sparkles } from "lucide-react";
import { VoiceOrb } from "@/components/voice-orb";
import { PosterTiles } from "@/components/poster-tiles";
import { HealthBanner } from "@/components/health-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomSession } from "@/hooks/use-room-session";
import { useRoomUi } from "@/hooks/use-room-ui";
import { useWatchNext } from "@/hooks/use-watchnext";
import { primaryActionClass } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

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
      <main className="mx-auto flex h-full max-w-xl flex-col justify-between overflow-hidden px-6 py-6 md:px-8">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-violet-300 uppercase">
              Room
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Voice room</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              One device hears everyone nearby. Talk it out, then we pick from
              the catalog.
            </p>
          </div>
          <HealthBanner />
          {room.micHint ? (
            <div className="border border-amber-500/30 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-100">
              {room.micHint} You can still start and type what you want to watch.
            </div>
          ) : null}
        </div>
        <VoiceOrb state="idle" />
        <div className="space-y-3">
          <Button
            type="button"
            className={cn("w-full", primaryActionClass)}
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
        </div>
      </main>
    );
  }

  const hasResults = Boolean(room.result?.titles.length);

  return (
    <main
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#0a0414] px-4 md:px-8"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-[11px] tracking-[0.28em] text-violet-300 uppercase">
          {room.orb === "connecting" ? "Room starting" : "Room live"}
        </p>
        <button
          type="button"
          className="text-[11px] tracking-[0.18em] text-violet-200/70 uppercase transition-colors hover:text-violet-100"
          onClick={() => room.setCaptions(!room.captions)}
        >
          Captions {room.captions ? "on" : "off"}
        </button>
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1",
          hasResults
            ? "grid-rows-[auto_minmax(0,1fr)] gap-3 py-3 md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-1 md:gap-8 md:py-4"
            : "place-items-center py-4"
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3",
            hasResults && "md:self-center"
          )}
        >
          <VoiceOrb state={room.orb} size={hasResults ? "sm" : "md"} />
          <RoomCaption room={room} />
        </div>
        {hasResults && room.result ? (
          <div className="h-full min-h-0 w-full">
            <PosterTiles titles={room.result.titles} layout="rail" />
          </div>
        ) : null}
      </div>

      {!room.micEnabled ? (
        <div className="mx-auto w-full max-w-lg shrink-0 pb-2">
          <RoomTextComposer
            busy={room.busy}
            onSubmit={(text) => void room.submitText(text)}
          />
        </div>
      ) : null}

      <RoomControls
        micEnabled={room.micEnabled}
        muted={room.muted}
        busy={room.busy}
        connecting={room.orb === "connecting"}
        onMute={() => room.setMuted(!room.muted)}
        onSuggest={() => void room.suggest()}
        onEnd={room.stop}
      />
    </main>
  );
}

function RoomCaption({
  room,
}: {
  room: ReturnType<typeof useRoomSession>;
}) {
  if (!room.captions) return null;

  let body: ReactNode = null;
  if (room.liveHeard) {
    body = (
      <span className="text-violet-100/70">
        “{room.liveHeard}
        <span className="ml-0.5 inline-block animate-pulse">▍</span>”
      </span>
    );
  } else if (room.lastHeard) {
    body = <span className="text-violet-100/80">“{room.lastHeard}”</span>;
  } else if (room.result?.spokenPitch) {
    body = <span className="text-violet-100/75">{room.result.spokenPitch}</span>;
  } else if (room.status) {
    body = <span className="text-violet-200/55">{room.status}</span>;
  } else if (room.orb === "connecting") {
    body = <span className="text-violet-200/55">Opening the live session…</span>;
  } else if (room.orb === "thinking") {
    body = <span className="text-violet-200/45">Finding a pick…</span>;
  } else if (room.orb === "listening") {
    body = <span className="text-violet-200/45">Listening…</span>;
  }

  if (!body) return null;

  return (
    <p className="line-clamp-2 min-h-10 max-w-sm text-center text-sm md:max-w-none">
      {body}
    </p>
  );
}

function RoomControls({
  micEnabled,
  muted,
  busy,
  connecting,
  onMute,
  onSuggest,
  onEnd,
}: {
  micEnabled: boolean;
  muted: boolean;
  busy: boolean;
  connecting: boolean;
  onMute: () => void;
  onSuggest: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg shrink-0 overflow-hidden border border-white/12">
      {micEnabled ? (
        <ControlKey
          icon={<MicOff className="size-4" />}
          label={muted ? "Unmute" : "Mute"}
          onClick={onMute}
          disabled={connecting}
        />
      ) : null}
      <ControlKey
        icon={<Sparkles className="size-4" />}
        label="Suggest"
        emphasize
        onClick={onSuggest}
        disabled={busy || connecting}
      />
      <ControlKey
        icon={<PhoneOff className="size-4" />}
        label="End"
        danger
        onClick={onEnd}
      />
    </div>
  );
}

function ControlKey({
  icon,
  label,
  emphasize,
  danger,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  emphasize?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-r border-white/12 text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors last:border-r-0 disabled:pointer-events-none disabled:opacity-50",
        emphasize && "bg-violet-600 text-white hover:bg-violet-500",
        danger && "text-rose-200 hover:bg-rose-950/55",
        !emphasize && !danger && "text-violet-100/80 hover:bg-white/5"
      )}
    >
      {icon}
      {label}
    </button>
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
        className="h-11 rounded-none bg-white/5 px-3 text-sm"
        disabled={busy}
        aria-label="Type what you want to watch"
      />
      <Button
        type="submit"
        className={cn("rounded-none px-5", primaryActionClass)}
        disabled={busy || !draft.trim()}
      >
        Send
      </Button>
    </form>
  );
}
