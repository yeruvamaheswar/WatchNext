type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: { transcript?: string };
  }>;
};

export type LiveSpeechHandlers = {
  onPartial: (text: string) => void;
  onError?: (error: string) => void;
};

export type LiveSpeechSession = {
  stop: () => void;
  beginUtterance: () => void;
  takeUtterance: () => string;
  peek: () => string;
};

function speechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canUseLiveSpeech() {
  return Boolean(speechRecognitionCtor());
}

/** Browser STT with interim results. Avoid pairing this with getUserMedia — they fight for the mic. */
export function startLiveSpeech(handlers: LiveSpeechHandlers): LiveSpeechSession | null {
  const Ctor = speechRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

  let stopped = false;
  let finals: string[] = [];
  let interim = "";

  const currentText = () =>
    [...finals, interim].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  rec.onresult = (event) => {
    let nextInterim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const piece = result[0]?.transcript?.trim() ?? "";
      if (!piece) continue;
      if (result.isFinal) finals.push(piece);
      else nextInterim += (nextInterim ? " " : "") + piece;
    }
    interim = nextInterim;
    const text = currentText();
    if (text) handlers.onPartial(text);
  };

  rec.onerror = (event) => {
    const error = event.error ?? "unknown";
    if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture") {
      stopped = true;
      handlers.onError?.(error);
      return;
    }
    if (error === "no-speech" || error === "aborted") return;
    handlers.onError?.(error);
  };

  rec.onend = () => {
    if (stopped) return;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop() {
      stopped = true;
      try {
        rec.abort();
      } catch {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
    },
    beginUtterance() {
      finals = [];
      interim = "";
    },
    takeUtterance() {
      const text = currentText();
      finals = [];
      interim = "";
      return text;
    },
    peek: currentText,
  };
}
