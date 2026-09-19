/** Group-mode energy VAD: ignore low background; auto-suggest after sustained silence. */

export const GROUP_SILENCE_MS = 6000;
/** Ignore sub-threshold dips shorter than this when starting the silence clock. */
export const GROUP_SILENCE_DEBOUNCE_MS = 300;
export const GROUP_MAX_LISTEN_MS = 15 * 60 * 1000;
/** First window used to estimate room noise floor. */
export const GROUP_NOISE_CALIBRATE_MS = 1000;

export type GroupVadState = {
  noiseFloor: number;
  calibrated: boolean;
  speaking: boolean;
  heardSpeech: boolean;
  silenceStartedAt: number | null;
  underSince: number | null;
};

export function createGroupVadState(): GroupVadState {
  return {
    noiseFloor: 0.012,
    calibrated: false,
    speaking: false,
    heardSpeech: false,
    silenceStartedAt: null,
    underSince: null,
  };
}

function rmsFromTimeDomain(data: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, data.length));
}

/**
 * Speech threshold sits above calibrated floor so TV/AC hum does not count as talk.
 */
export function speechThreshold(noiseFloor: number) {
  return Math.max(0.028, noiseFloor * 3.2 + 0.012);
}

export type VadTickResult = {
  speaking: boolean;
  /** True when silence has lasted GROUP_SILENCE_MS after some speech. */
  shouldAutoSuggest: boolean;
  silenceMs: number;
};

export function tickGroupVad(
  state: GroupVadState,
  analyser: AnalyserNode,
  now: number,
  elapsedMs: number
): VadTickResult {
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  const level = rmsFromTimeDomain(buf);

  if (!state.calibrated) {
    if (elapsedMs < GROUP_NOISE_CALIBRATE_MS) {
      state.noiseFloor = state.noiseFloor * 0.85 + level * 0.15;
      return { speaking: false, shouldAutoSuggest: false, silenceMs: 0 };
    }
    state.calibrated = true;
    state.noiseFloor = Math.max(0.006, Math.min(0.04, state.noiseFloor));
  }

  const threshold = speechThreshold(state.noiseFloor);
  const isLoud = level >= threshold;

  if (isLoud) {
    state.underSince = null;
    state.silenceStartedAt = null;
    state.speaking = true;
    state.heardSpeech = true;
    // Slow adapt floor downward only — never chase speech peaks
    state.noiseFloor = Math.min(state.noiseFloor, level * 0.35 + state.noiseFloor * 0.65);
    return { speaking: true, shouldAutoSuggest: false, silenceMs: 0 };
  }

  state.speaking = false;
  if (!state.heardSpeech) {
    return { speaking: false, shouldAutoSuggest: false, silenceMs: 0 };
  }

  if (state.underSince == null) state.underSince = now;
  const underFor = now - state.underSince;
  if (underFor < GROUP_SILENCE_DEBOUNCE_MS) {
    return { speaking: false, shouldAutoSuggest: false, silenceMs: 0 };
  }

  if (state.silenceStartedAt == null) {
    state.silenceStartedAt = state.underSince + GROUP_SILENCE_DEBOUNCE_MS;
  }
  const silenceMs = now - state.silenceStartedAt;
  return {
    speaking: false,
    shouldAutoSuggest: silenceMs >= GROUP_SILENCE_MS,
    silenceMs,
  };
}
