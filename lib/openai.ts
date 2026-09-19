import OpenAI from "openai";
import { getServerEnv, requireOpenAI } from "@/lib/env";

let cached: OpenAI | null = null;

export function getOpenAI() {
  const apiKey = requireOpenAI();
  if (cached) return cached;
  cached = new OpenAI({ apiKey });
  return cached;
}

export function openaiModels() {
  const env = getServerEnv();
  return {
    embedding: env.embeddingModel,
    chat: env.chatModel,
    transcribe: env.transcribeModel,
    tts: env.ttsModel,
    voice: env.ttsVoice,
  };
}
