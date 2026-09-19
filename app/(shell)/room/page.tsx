"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Clapperboard, Mic, MicOff, Search, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { VoiceOrb } from "@/components/voice-orb";
import { PosterTiles } from "@/components/poster-tiles";
import { HealthBanner } from "@/components/health-banner";
import { useRoomSession } from "@/hooks/use-room-session";
import { useRoomUi } from "@/hooks/use-room-ui";
import { useWatchNext } from "@/hooks/use-watchnext";
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
    const hasResults = Boolean(room.result?.titles.length);
    const idleOrb = room.orb === "thinking" ? "thinking" : "idle";

    return (
      <main className="mx-auto flex h-full max-w-xl flex-col overflow-hidden px-6 py-6 md:px-8">
        <div className="shrink-0 space-y-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.16em] text-violet-300 uppercase">
              Room
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Voice room</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Type a search, or start a session so one device can hear everyone
              nearby.
            </p>
          </div>
          <HealthBanner />
          {room.micHint ? (
            <div className="border border-amber-500/30 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-100">
              {room.micHint} Text search works without the microphone.
            </div>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {hasResults && room.result ? (
            <div className="min-h-0 flex-1 py-4">
              <PosterTiles titles={room.result.titles} layout="rail" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
              <VoiceOrb state={idleOrb} />
            </div>
          )}
          <div className="flex shrink-0 flex-col items-center gap-3 pt-2">
            {room.busy ? (
              <p className="text-center text-xs text-violet-200/55">Finding a pick…</p>
            ) : room.lastHeard ? (
              <p className="max-w-sm text-center text-sm text-violet-100/80">
                “{room.lastHeard}”
              </p>
            ) : null}
            <RoomTextSearch
              busy={room.busy}
              onSubmit={(text) => void room.submitText(text)}
            />
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
                ? "Mic access needs HTTPS or localhost. Search by text anytime."
                : "The mic turns on only after you start a session."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const hasResults = Boolean(room.result?.titles.length);
  const cluster = <RoomDock room={room} compact={hasResults} />;

  return (
    <main
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#0a0414] px-3 md:px-8"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo />
          <p className="hidden text-[11px] font-medium tracking-[0.16em] text-violet-300 uppercase sm:block">
            {room.orb === "connecting" ? "Room starting" : "Room live"}
          </p>
        </div>
        <button
          type="button"
          className="text-[11px] tracking-[0.18em] text-violet-200/70 uppercase transition-colors hover:text-violet-100"
          onClick={() => room.setCaptions(!room.captions)}
        >
          Captions {room.captions ? "on" : "off"}
        </button>
      </div>

      {hasResults && room.result ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2 py-2 md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1 md:gap-8 md:py-4">
          <div className="order-2 flex flex-col items-center justify-end md:order-1 md:justify-center">
            {cluster}
          </div>
          <div className="order-1 min-h-0 w-full md:order-2">
            <PosterTiles titles={room.result.titles} layout="rail" />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-end py-3 md:justify-center md:py-4">
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
  const orb = room.orb;
  const micEnabled = room.micEnabled;
  const controls = {
    micEnabled,
    muted: room.muted,
    busy: room.busy,
    connecting: orb === "connecting",
    onMute: () => room.setMuted(!room.muted),
    onSuggest: () => void room.suggest(),
    onEnd: room.stop,
  };

  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center",
        compact ? "gap-1 md:gap-3" : "gap-1.5 md:gap-3"
      )}
    >
      <div className="md:hidden">
        <RoomCaption room={room} compact />
      </div>

      <div className="hidden md:contents">
        <VoiceOrb state={orb} size={compact ? "sm" : "md"} docked />
        <RoomCaption room={room} compact={compact} />
      </div>

      <RoomTextSearch
        busy={room.busy}
        autoOpen={!micEnabled}
        persistOpen={!micEnabled}
        onSubmit={(text) => void room.submitText(text)}
      />

      <div className="flex w-full max-w-[13.5rem] items-center justify-between md:hidden">
        {micEnabled ? (
          <ControlKey
            icon={room.muted ? <MicOff /> : <Mic />}
            label={room.muted ? "Unmute" : "Mute"}
            pressed={room.muted}
            onClick={controls.onMute}
            disabled={controls.connecting}
            iconOnly
          />
        ) : (
          <span className="size-8" />
        )}
        <VoiceOrb state={orb} size="xs" docked hideLabel />
        <ControlKey
          icon={<X />}
          label="End"
          danger
          onClick={controls.onEnd}
          iconOnly
        />
      </div>

      <div className="hidden md:block">
        <RoomControls {...controls} />
      </div>
    </div>
  );
}

function RoomCaption({
  room,
  compact = false,
}: {
  room: ReturnType<typeof useRoomSession>;
  compact?: boolean;
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
    <p
      className={cn(
        "max-w-sm text-center",
        compact
          ? "line-clamp-1 text-xs text-violet-100/75 md:line-clamp-2 md:min-h-10 md:text-sm"
          : "line-clamp-2 min-h-8 text-sm md:min-h-10"
      )}
    >
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
    <div className="flex items-start justify-center gap-5 md:gap-6">
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
        icon={<Clapperboard />}
        label="Suggest"
        emphasize
        onClick={onSuggest}
        disabled={busy || connecting}
      />
      <ControlKey
        icon={<X />}
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
  iconOnly,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  emphasize?: boolean;
  danger?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center disabled:pointer-events-none disabled:opacity-40",
        iconOnly ? "justify-center" : "flex-col gap-1 md:gap-1.5"
      )}
    >
      <span
        className={cn(
          "grid place-items-center transition-colors",
          iconOnly
            ? "size-8 [&_svg]:size-[1.15rem]"
            : "size-8 rounded-lg [&_svg]:size-4 md:size-12 md:rounded-2xl md:[&_svg]:size-5",
          emphasize &&
            (iconOnly
              ? "text-violet-100"
              : "text-violet-200 md:bg-violet-500/20 md:text-violet-100 md:ring-1 md:ring-inset md:ring-violet-300/25 md:group-hover:bg-violet-500/30"),
          danger &&
            (iconOnly
              ? "text-rose-300/85"
              : "text-rose-300/80 md:bg-white/6 md:text-rose-300/90 md:group-hover:bg-rose-500/15 md:group-hover:text-rose-200"),
          !emphasize &&
            !danger &&
            (pressed
              ? iconOnly
                ? "text-white"
                : "text-white md:bg-white/16"
              : iconOnly
                ? "text-violet-100/80"
                : "text-violet-200/70 md:bg-white/8 md:text-violet-100/85 md:group-hover:bg-white/12")
        )}
      >
        {icon}
      </span>
      {iconOnly ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span
          className={cn(
            "text-[10px] md:text-xs",
            emphasize && "text-violet-200 md:text-violet-200/65 md:group-hover:text-violet-100",
            danger && "text-rose-300/75 md:text-violet-200/65 md:group-hover:text-violet-100",
            !emphasize &&
              !danger &&
              "text-violet-200/60 md:text-violet-200/65 md:group-hover:text-violet-100"
          )}
        >
          {label}
        </span>
      )}
    </button>
  );
}

function RoomTextSearch({
  busy,
  autoOpen,
  persistOpen,
  onSubmit,
}: {
  busy: boolean;
  autoOpen?: boolean;
  persistOpen?: boolean;
  onSubmit: (text: string) => void;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setDraft("");
    setOpen(false);
    toggleRef.current?.focus();
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (!persistOpen) setOpen(false);
    onSubmit(text);
  }

  function toggle() {
    if (open && draft.trim()) {
      submit();
      return;
    }
    if (open) {
      close();
      return;
    }
    setOpen(true);
  }

  return (
    <form
      className={cn(
        "flex items-center overflow-hidden border-b transition-[width,border-color] duration-200",
        open
          ? "w-full max-w-[16rem] border-violet-300/25"
          : "w-8 border-transparent"
      )}
      onSubmit={submit}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-label={
          open && draft.trim()
            ? "Search"
            : open
              ? "Close text search"
              : "Search by text"
        }
        aria-expanded={open}
        title="Search by text"
        onClick={toggle}
        className={cn(
          "grid size-8 shrink-0 place-items-center transition-colors",
          open
            ? "text-violet-100"
            : "text-violet-200/55 hover:text-violet-100"
        )}
      >
        <Search className="size-4" strokeWidth={1.6} />
      </button>
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="What do you want to watch?"
        disabled={busy}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        aria-label="Type what you want to watch"
        className={cn(
          "h-8 min-w-0 flex-1 bg-transparent text-sm text-violet-50 outline-none placeholder:text-violet-200/35 disabled:opacity-50",
          open ? "pr-1" : "pointer-events-none w-0 px-0"
        )}
      />
    </form>
  );
}
