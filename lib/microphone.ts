/** Browsers only expose getUserMedia in a secure context (HTTPS or localhost). */
export function getUserMediaFn(): MediaDevices["getUserMedia"] | null {
  if (typeof navigator === "undefined") return null;
  const modern = navigator.mediaDevices?.getUserMedia;
  if (typeof modern === "function") return modern.bind(navigator.mediaDevices);
  const legacy = (
    navigator as Navigator & {
      getUserMedia?: MediaDevices["getUserMedia"];
      webkitGetUserMedia?: MediaDevices["getUserMedia"];
    }
  ).webkitGetUserMedia;
  if (typeof legacy === "function") {
    return (constraints) =>
      new Promise((resolve, reject) => {
        (
          navigator as Navigator & {
            webkitGetUserMedia: (
              c: MediaStreamConstraints,
              ok: (s: MediaStream) => void,
              err: (e: Error) => void
            ) => void;
          }
        ).webkitGetUserMedia(constraints, resolve, reject);
      });
  }
  return null;
}

export function microphoneBlockReason(): string | null {
  if (typeof window === "undefined") return null;
  if (getUserMediaFn()) return null;
  const host = window.location.hostname;
  const loopback =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  if (!window.isSecureContext || !loopback) {
    return "This browser blocks the microphone on HTTP except localhost. On this computer open http://127.0.0.1:3000, or run npm run dev:https and use the https URL on your phone.";
  }
  return "This browser has no microphone API. Try Chrome or Safari, or run npm run dev:https.";
}
