export type RealtimeEvent = {
  type: string;
  [key: string]: unknown;
};

export type RealtimeHandle = {
  send: (event: RealtimeEvent) => void;
  setMuted: (muted: boolean) => void;
  close: () => void;
};

export async function connectRealtime(options: {
  clientSecret: string;
  stream: MediaStream;
  audioEl: HTMLAudioElement;
  onEvent: (event: RealtimeEvent) => void;
}): Promise<RealtimeHandle> {
  const pc = new RTCPeerConnection();
  const audio = options.audioEl;
  audio.autoplay = true;

  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0] ?? null;
    void audio.play().catch(() => {});
  };

  for (const track of options.stream.getAudioTracks()) {
    pc.addTrack(track, options.stream);
  }

  const dc = pc.createDataChannel("oai-events");
  dc.addEventListener("message", (event) => {
    const raw = typeof event.data === "string" ? event.data : "";
    if (!raw) return;
    try {
      options.onEvent(JSON.parse(raw) as RealtimeEvent);
    } catch {
      /* ignore torn frames */
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const answerSdp = await exchangeSdp(options.clientSecret, offer.sdp ?? "");
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return {
    send(event) {
      if (dc.readyState === "open") dc.send(JSON.stringify(event));
    },
    setMuted(muted) {
      for (const track of options.stream.getAudioTracks()) track.enabled = !muted;
    },
    close() {
      try {
        dc.close();
      } catch {
        /* ignore */
      }
      pc.close();
      audio.pause();
      audio.srcObject = null;
    },
  };
}

async function exchangeSdp(clientSecret: string, offerSdp: string) {
  const headers = {
    Authorization: `Bearer ${clientSecret}`,
    "Content-Type": "application/sdp",
  };
  let res = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers,
    body: offerSdp,
  });
  if (!res.ok) {
    res = await fetch("https://api.openai.com/v1/realtime?model=gpt-realtime", {
      method: "POST",
      headers: { ...headers, "OpenAI-Beta": "realtime=v1" },
      body: offerSdp,
    });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Could not start a Realtime call.");
  }
  return res.text();
}
