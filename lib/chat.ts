import { ConfigError } from "@/lib/config-error";
import { extractIntent } from "@/lib/extract";
import { getOpenAI, openaiModels } from "@/lib/openai";
import { recommend } from "@/lib/recommend";
import type {
  ChatMessage,
  ChatTurnInput,
  ChatTurnResult,
  ExtractedIntent,
  GuestLike,
} from "@/lib/types";

const WATCH_HINT =
  /\b(watch|movie|show|film|series|recommend|suggest|tonight|something)\b/i;

function shouldSuggest(intent: ExtractedIntent, text: string) {
  const entityCount =
    intent.titles.length +
    intent.people.length +
    intent.genres.length +
    intent.moods.length;
  return intent.watchIntent || entityCount >= 2 || WATCH_HINT.test(text);
}

async function conversationalReply(
  message: string,
  history: ChatMessage[],
  extract: ExtractedIntent,
  note?: string
) {
  const openai = getOpenAI();
  const { chat } = openaiModels();
  const completion = await openai.chat.completions.create({
    model: chat,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You are WatchNext, a concise watch-night co-pilot. Help the user figure out what to watch.
Ask at most one clarifying question when needed. Keep replies under 60 words.
Never invent specific catalog titles with years unless they appear in tool notes.
If a note says catalog or recommend failed, acknowledge briefly and keep chatting.`,
      },
      ...history.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: "user",
        content: JSON.stringify({
          latestMessage: message,
          extractedIntent: extract,
          note: note ?? null,
        }),
      },
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "Tell me a mood, genre, or something you liked recently and I will narrow it down."
  );
}

/**
 * One Room chat turn: extract intent, optionally recommend from the local
 * catalog, otherwise reply conversationally via OpenAI chat.
 */
export async function runChatTurn(
  input: ChatTurnInput
): Promise<ChatTurnResult> {
  const message = input.message.trim();
  if (!message) {
    throw new ConfigError(
      "Missing message.",
      "BAD_REQUEST",
      "Send a non-empty chat message.",
      400
    );
  }

  const history = input.history ?? [];
  const prior = history
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(-4000);

  const extract = await extractIntent(message, prior);
  const likes = (input.likes ?? []) as GuestLike[];

  if (shouldSuggest(extract, message)) {
    try {
      const result = await recommend({
        userId: input.userId,
        likes,
        likedVibes: input.likedVibes,
        extract,
        queryText: extract.searchQuery || message,
        sessionExcludeIds: input.sessionExcludeIds,
      });
      return {
        reply: result.spokenPitch,
        extract,
        titles: result.titles,
        suggested: true,
      };
    } catch (err) {
      const note =
        err instanceof ConfigError
          ? `${err.message}${err.hint ? ` Hint: ${err.hint}` : ""}`
          : "Catalog recommend failed; stay conversational.";
      const reply = await conversationalReply(message, history, extract, note);
      return {
        reply,
        extract,
        titles: [],
        suggested: false,
      };
    }
  }

  const reply = await conversationalReply(message, history, extract);
  return {
    reply,
    extract,
    titles: [],
    suggested: false,
  };
}
