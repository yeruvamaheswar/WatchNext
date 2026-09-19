"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clapperboard, Mic, MicOff, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { VoiceOrb } from "@/components/voice-orb";
import { PosterTiles } from "@/components/poster-tiles";
import { HealthBanner } from "@/components/health-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGroupListen } from "@/hooks/use-group-listen";
import { useRoomSession } from "@/hooks/use-room-session";
import { useRoomUi } from "@/hooks/use-room-ui";
import { useWatchNext } from "@/hooks/use-watchnext";
import { primaryActionClass } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

export default function RoomPage() {
  const { userId, guest } = useWatchNext();
  const { setActive } = useRoomUi();
  const [groupMode, setGroupMode] = useState(false);

  const room = useRoomSession({
    userId,
    likes: guest.likes,
    likedVibes: guest.likedVibes,
    onActiveChange: setActive,
  });

  const group = useGroupListen({
    userId,
    likes: guest.likes,
    likedVibes: guest.likedVibes,
    onActiveChange: setActive,
  });

  useEffect(() => {
    return () => setActive(false);
  }, [setActive]);

  const sessionActive = groupMode ? group.active : room.active;

  if (!sessionActive) {
    return (
      <main className="mx-auto flex h-full max-w-xl flex-col overflow-hidden px-6 py-6 md:px-8">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.16em] text-violet-300 uppercase">
              Room
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Voice room</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {groupMode
                ? "Group mode listens on this phone, labels Person 1 / 2 / 3, then suggests what to watch together."
                : "One device hears everyone nearby. Talk it out, then we pick from the catalog."}
            </p>
          </div>
          <HealthBanner />
          {(groupMode ? group.micHint : room.micHint) ? (
            <div className="border border-amber-500/30 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-100">
              {groupMode ? group.micHint : room.micHint} You can still start
              {groupMode ? "." : " and type what you want to watch."}
            </div>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
          <VoiceOrb state="idle" />
          <div className="flex w-full max-w-xs flex-col items-center gap-3">
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-[6px] bg-violet-500 px-3.5 text-xs font-medium text-white transition-colors hover:bg-violet-400 disabled:pointer-events-none disabled:opacity-50 md:h-11 md:rounded-[8px] md:px-6 md:text-sm"
              onClick={() => void (groupMode ? group.start() : room.start())}
              disabled={
                groupMode
                  ? group.orb === "connecting"
                  : room.orb === "connecting"
              }
            >
              {groupMode ? "Start group listen" : "Start session"}
            </button>
            <GroupModeToggle
              checked={groupMode}
              onChange={setGroupMode}
              disabled={false}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {groupMode
              ? "Suggests after ~6s of silence, or tap Suggest. Mic needs HTTPS or localhost."
              : room.micHint
                ? "Type your request after starting. Mic access needs HTTPS or localhost."
                : "Mic access is used only while the session is on."}
          </p>
        </div>
      </main>
    );
  }

  if (groupMode && group.active) {
    return <GroupSessionView group={group} groupModeLocked />;
  }

  return <LiveSessionView room={room} />;
}

function GroupModeToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex w-full max-w-xs cursor-pointer items-center justify-between gap-3 rounded-[8px] border border-violet-500/25 bg-white/5 px-3 py-2 text-left",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Users className="size-3.5 shrink-0 text-violet-300" />
        <span className="min-w-0">
          <span className="block text-xs font-medium text-violet-100">
            Group mode
          </span>
          <span className="block text-[11px] text-muted-foreground">
            Listen, then suggest for everyone
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Group mode"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-violet-500" : "bg-white/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
    </label>
  );
}

function GroupSessionView({
  group,
  groupModeLocked,
}: {
  group: ReturnType<typeof useGroupListen>;
  groupModeLocked: boolean;
}) {
  const hasResults = Boolean(group.result?.titles.length);
  const dock = (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center",
        hasResults ? "gap-1 md:gap-3" : "gap-1.5 md:gap-3"
      )}
    >
      <div className="md:hidden">
        <p className="line-clamp-1 max-w-sm text-center text-xs text-violet-100/75 md:line-clamp-2 md:min-h-10 md:text-sm">
          {group.status ||
            (group.orb === "thinking"
              ? "Finding a group pick…"
              : group.orb === "listening"
                ? "Listening to the group…"
                : null)}
        </p>
      </div>

      <div className="flex w-full max-w-[13.5rem] items-center justify-between md:hidden">
        <span className="size-8" />
        <VoiceOrb state={group.orb} size="xs" docked hideLabel />
        <ControlKey
          icon={<X />}
          label="End"
          danger
          onClick={group.stop}
          iconOnly
        />
      </div>

      <div className="hidden md:block">
        <VoiceOrb state={group.orb} size={hasResults ? "sm" : "md"} docked />
      </div>

      <div className="hidden w-full md:block">
        <p className="line-clamp-2 min-h-8 max-w-sm text-center text-sm text-violet-200/70 md:min-h-10">
          {group.status ||
            (group.orb === "thinking"
              ? "Finding a group pick…"
              : group.orb === "listening"
                ? "Listening to the group…"
                : null)}
        </p>
        {hasResults && group.result?.spokenPitch ? (
          <p className="mt-1 line-clamp-3 max-w-sm text-center text-sm text-violet-100/80">
            {group.result.spokenPitch}
          </p>
        ) : null}
      </div>

      <div className="hidden md:block">
        <div className="flex items-start justify-center gap-5 md:gap-6">
          <ControlKey
            icon={<Clapperboard />}
            label="Suggest"
            emphasize
            onClick={() => group.suggest()}
            disabled={group.busy || group.orb === "connecting"}
          />
          <ControlKey icon={<X />} label="End" danger onClick={group.stop} />
        </div>
      </div>

      <GroupModeToggle checked onChange={() => {}} disabled={groupModeLocked} />

      {group.segments.length > 0 ? (
        <div className="mt-1 max-h-28 w-full overflow-y-auto rounded-lg border border-violet-500/20 bg-black/30 px-3 py-2 text-left text-[11px] text-violet-100/75">
          {group.segments.slice(-8).map((seg, i) => (
            <p
              key={`${seg.speaker}-${seg.start}-${i}`}
              className="mb-1 last:mb-0"
            >
              <span className="font-medium text-violet-200">{seg.speaker}:</span>{" "}
              {seg.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );

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
            Group listen
          </p>
        </div>
        <p className="text-[11px] text-violet-200/60">
          {Math.floor(group.elapsedMs / 1000)}s
        </p>
      </div>

      {hasResults && group.result ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2 py-2 md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-1 md:gap-8 md:py-4">
          <div className="order-2 flex flex-col items-center justify-end md:order-1 md:justify-center">
            {dock}
          </div>
          <div className="order-1 min-h-0 w-full md:order-2">
            <PosterTiles titles={group.result.titles} layout="rail" />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-end py-3 md:justify-center md:py-4">
          {dock}
        </div>
      )}
    </main>
  );
}

function LiveSessionView({
  room,
}: {
  room: ReturnType<typeof useRoomSession>;
}) {
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

      {!micEnabled ? (
        <RoomTextComposer
          busy={room.busy}
          onSubmit={(text) => void room.submitText(text)}
        />
      ) : null}

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
        <VoiceOrb state={orb} size={compact ? "sm" : "md"} docked />
      </div>

      <div className="hidden w-full md:block">
        <RoomCaption room={room} compact={compact} />
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
      <ControlKey icon={<X />} label="End" danger onClick={onEnd} />
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
            emphasize &&
              "text-violet-200 md:text-violet-200/65 md:group-hover:text-violet-100",
            danger &&
              "text-rose-300/75 md:text-violet-200/65 md:group-hover:text-violet-100",
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
