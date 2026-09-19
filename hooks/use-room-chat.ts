"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type {
  ChatMessage,
  ChatTurnResult,
  GuestLike,
  SuggestedTitle,
} from "@/lib/types";

type Options = {
  userId: string;
  likes: GuestLike[];
  likedVibes: string[];
};

export type RoomChatMessage = ChatMessage & {
  id: string;
  titles?: SuggestedTitle[];
};

let msgSeq = 0;
function nextId() {
  msgSeq += 1;
  return `m-${Date.now()}-${msgSeq}`;
}

export function useRoomChat({ userId, likes, likedVibes }: Options) {
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [titles, setTitles] = useState<SuggestedTitle[]>([]);
  const [excludeIds, setExcludeIds] = useState<number[]>([]);

  const send = useCallback(
    async (text?: string) => {
      const message = (text ?? draft).trim();
      if (!message || busy) return;

      const userMsg: RoomChatMessage = {
        id: nextId(),
        role: "user",
        content: message,
      };
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      setDraft("");
      setMessages((prev) => [...prev, userMsg]);
      setBusy(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            userId,
            likes,
            likedVibes,
            sessionExcludeIds: excludeIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            [data.error, data.hint].filter(Boolean).join(" — ") || "Chat failed."
          );
        }
        const turn = data as ChatTurnResult;
        if (turn.titles?.length) {
          setExcludeIds((prev) => [
            ...prev,
            ...turn.titles.map((t) => t.tmdbId),
          ]);
          setTitles(turn.titles);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content: turn.reply,
            titles: turn.titles?.length ? turn.titles : undefined,
          },
        ]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Chat failed.");
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content:
              err instanceof Error
                ? err.message
                : "I could not reach the chat service. Check OPENAI_API_KEY and try again.",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, draft, excludeIds, likedVibes, likes, messages, userId]
  );

  return {
    messages,
    draft,
    setDraft,
    busy,
    titles,
    send,
  };
}
