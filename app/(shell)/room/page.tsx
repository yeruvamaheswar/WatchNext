"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";
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
      <main className="mx-auto flex h-full max-w-xl flex-col overflow-hidden px-6 py-6 md:px-8">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.16em] text-violet-300 uppercase">
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
          <VoiceOrb state="idle" />
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-[6px] bg-violet-500 px-3.5 text-xs font-medium text-white transition-colors hover:bg-violet-400 disabled:pointer-events-none disabled:opacity-50 md:h-11 md:rounded-[8px] md:px-6 md:text-sm"
            onClick={() => void room.start()}
            disabled={room.orb === "connecting"}
          >
            Start session
          </button>
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
  const cluster = (
    <RoomDock
      room={room}
      compact={hasResults}
    />
  );

  return (
    <main
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#0a0414] px-4 md:px-8"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-[11px] font-medium tracking-[0.16em] text-violet-300 uppercase">
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

      {hasResults && room.result ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 py-3 md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1 md:gap-8 md:py-4">
          <div className="order-2 flex flex-col items-center justify-end md:order-1 md:justify-center">
            {cluster}
          </div>
          <div className="order-1 min-h-0 w-full md:order-2">
            <PosterTiles titles={room.result.titles} layout="rail" />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-end py-4 md:justify-center">
          {cluster}
        </div>
      )}
    </main>
  );
}

function RoomDock({
  room,
  compact,
}: {
  room: ReturnType<typeof useRoomSession>;
  compact: boolean;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2 md:gap-3">
      <VoiceOrb state={room.orb} size={compact ? "sm" : "md"} docked />
      <RoomCaption room={room} />
      {!room.micEnabled ? (
        <RoomTextComposer
          busy={room.busy}
          onSubmit={(text) => void room.submitText(text)}
        />
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
    </div>
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
    <p className="line-clamp-2 min-h-10 max-w-sm text-center text-sm">
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
    <div className="flex items-center justify-center gap-4 md:items-start md:gap-6">
      {micEnabled ? (
        <ControlKey
          icon={muted ? <MicOff /> : <Mic />}
          label={muted ? "Unmute" : "Mute"}
          pressed={muted}
          onClick={onMute}
          disabled={connecting}
        />
      ) : null}
      <ControlKey
        icon={<Sparkles />}
        label="Suggest"
        emphasize
        onClick={onSuggest}
        disabled={busy || connecting}
      />
      <ControlKey
        icon={<PhoneOff />}
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
  pressed,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  emphasize?: boolean;
  danger?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      className="group inline-flex items-center gap-1 disabled:pointer-events-none disabled:opacity-40 md:flex-col md:gap-1.5"
    >
      <span
        className={cn(
          "grid place-items-center transition-colors [&_svg]:size-3.5 md:size-12 md:rounded-2xl md:[&_svg]:size-5",
          emphasize &&
            "text-violet-200 md:bg-violet-500/20 md:text-violet-100 md:ring-1 md:ring-inset md:ring-violet-300/25 md:group-hover:bg-violet-500/30",
          danger &&
            "text-rose-300/80 md:bg-white/6 md:text-rose-300/90 md:group-hover:bg-rose-500/15 md:group-hover:text-rose-200",
          !emphasize &&
            !danger &&
            (pressed
              ? "text-white md:bg-white/16"
              : "text-violet-200/70 md:bg-white/8 md:text-violet-100/85 md:group-hover:bg-white/12")
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "text-[11px] md:text-xs",
          emphasize && "text-violet-200 md:text-violet-200/65 md:group-hover:text-violet-100",
          danger && "text-rose-300/75 md:text-violet-200/65 md:group-hover:text-violet-100",
          !emphasize &&
            !danger &&
            "text-violet-200/60 md:text-violet-200/65 md:group-hover:text-violet-100"
        )}
      >
        {label}
      </span>
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
      className="flex w-full gap-2"
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
        className="h-8 rounded-md bg-white/5 px-3 text-sm md:h-11 md:rounded-xl"
        disabled={busy}
        aria-label="Type what you want to watch"
      />
      <Button
        type="submit"
        className={cn("px-4", primaryActionClass)}
        disabled={busy || !draft.trim()}
      >
        Send
      </Button>
    </form>
  );
}
