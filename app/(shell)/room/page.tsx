"use client";

import { useEffect, useRef } from "react";
import { MicOff, PhoneOff, Captions, Sparkles, Send, Mic } from "lucide-react";
import { VoiceOrb } from "@/components/voice-orb";
import { PosterTiles } from "@/components/poster-tiles";
import { HealthBanner } from "@/components/health-banner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRoomChat } from "@/hooks/use-room-chat";
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
  const chat = useRoomChat({
    userId,
    likes: guest.likes,
    likedVibes: guest.likedVibes,
  });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => setActive(false);
  }, [setActive]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat.messages, chat.busy]);

  if (room.active) {
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
            Room live
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

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6 pb-28">
      <div>
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">
          Room
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Chat room</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Type what you are in the mood for, or start a voice session. We only
          suggest when you ask for a pick.
        </p>
      </div>
      <HealthBanner />

      <div
        ref={listRef}
        data-testid="chat-messages"
        className="flex max-h-[50vh] min-h-[12rem] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3"
      >
        {chat.messages.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
            Try “something funny but not scary” or “a short series under an
            hour.”
          </p>
        ) : (
          chat.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                m.role === "user"
                  ? "ml-auto bg-violet-600/80 text-white"
                  : "mr-auto bg-white/5 text-violet-50"
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.titles?.length ? (
                <div className="mt-3">
                  <PosterTiles titles={m.titles} />
                </div>
              ) : null}
            </div>
          ))
        )}
        {chat.busy ? (
          <p className="text-xs text-muted-foreground">Thinking…</p>
        ) : null}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void chat.send();
        }}
      >
        <Textarea
          data-testid="chat-input"
          value={chat.draft}
          onChange={(e) => chat.setDraft(e.target.value)}
          placeholder="What are you in the mood for?"
          rows={2}
          className="min-h-12 flex-1 resize-none rounded-2xl border-white/15 bg-black/30 px-3 py-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void chat.send();
            }
          }}
          disabled={chat.busy}
        />
        <Button
          type="submit"
          data-testid="chat-send"
          className="h-12 w-12 shrink-0 rounded-full bg-violet-500 text-white hover:bg-violet-400"
          disabled={chat.busy || !chat.draft.trim()}
          aria-label="Send"
        >
          <Send className="size-4" />
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="h-12 rounded-full"
        onClick={() => void room.start()}
      >
        <Mic className="size-4" />
        Start voice session
      </Button>
    </main>
  );
}
