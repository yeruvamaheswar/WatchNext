import type { RealtimeSessionCreateRequest } from "openai/resources/realtime/realtime";
import { openaiModels } from "@/lib/openai";
import { RECOMMEND_TOOL_NAME } from "@/lib/realtime-constants";

export { RECOMMEND_TOOL_NAME };

export function realtimeSessionConfig(): RealtimeSessionCreateRequest {
  const { realtime, realtimeVoice, transcribe } = openaiModels();
  return {
    type: "realtime",
    model: realtime,
    instructions: `You are WatchNext's voice host. One phone hears everyone in the room.
Keep replies to one short spoken sentence.
When they want something to watch, or they name enough genres, moods, people, or titles, call ${RECOMMEND_TOOL_NAME}.
Never invent catalog titles. Only talk about titles that tool returns.
If they are just chatting, ask one short clarifying question instead of guessing.
After the tool returns, pitch the picks using spokenPitch and the title names. No long synopses.`,
    output_modalities: ["audio"],
    tool_choice: "auto",
    tools: [
      {
        type: "function",
        name: RECOMMEND_TOOL_NAME,
        description:
          "Search the WatchNext catalog and pick 1-3 titles. Call when they want a watch-now pick or have named enough preference.",
        parameters: {
          type: "object",
          properties: {
            queryText: {
              type: "string",
              description: "What they asked for, in their words.",
            },
            mediaType: {
              type: "string",
              enum: ["movie", "tv", "any"],
            },
            genres: {
              type: "array",
              items: { type: "string" },
              description: "TMDB genre names such as Comedy, Action, Horror.",
            },
            moods: { type: "array", items: { type: "string" } },
            people: { type: "array", items: { type: "string" } },
            titles: {
              type: "array",
              items: { type: "string" },
              description: "Titles they mentioned.",
            },
          },
          required: ["queryText"],
        },
      },
    ],
    audio: {
      input: {
        noise_reduction: { type: "far_field" },
        transcription: {
          model: transcribe === "whisper-1" ? "gpt-4o-mini-transcribe" : transcribe,
          language: "en",
          prompt: "Watch-night talk. Expect movie and TV titles, genres, actors, and moods.",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.45,
          prefix_padding_ms: 180,
          silence_duration_ms: 280,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: realtimeVoice,
      },
    },
  };
}
