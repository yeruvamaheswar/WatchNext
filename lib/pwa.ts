export const APP_NAME = "WatchNext";
export const APP_SHORT_NAME = "WatchNext";
export const APP_DESCRIPTION =
  "Swipe your taste, then get a watch-now pick — solo or in a voice room.";
export const APP_THEME_COLOR = "#6d28d9";
export const APP_BACKGROUND_COLOR = "#0c0614";

/** Measured by SafeAreaSync; falls back to env() before JS runs. */
export const PWA_HEADER_PAD = "max(0.5rem, var(--wn-safe-top, 0px))";
export const PWA_FOOTER_PAD = "max(0.5rem, var(--wn-safe-bottom, 0px))";

/** Apple splash pixel sizes + CSS media queries for Add to Home Screen. */
export const APPLE_SPLASH = [
  { width: 640, height: 1136, deviceWidth: 320, deviceHeight: 568, ratio: 2 },
  { width: 750, height: 1334, deviceWidth: 375, deviceHeight: 667, ratio: 2 },
  { width: 828, height: 1792, deviceWidth: 414, deviceHeight: 896, ratio: 2 },
  { width: 1080, height: 2340, deviceWidth: 360, deviceHeight: 780, ratio: 3 },
  { width: 1125, height: 2436, deviceWidth: 375, deviceHeight: 812, ratio: 3 },
  { width: 1170, height: 2532, deviceWidth: 390, deviceHeight: 844, ratio: 3 },
  { width: 1179, height: 2556, deviceWidth: 393, deviceHeight: 852, ratio: 3 },
  { width: 1206, height: 2622, deviceWidth: 402, deviceHeight: 874, ratio: 3 },
  { width: 1242, height: 2208, deviceWidth: 414, deviceHeight: 736, ratio: 3 },
  { width: 1242, height: 2688, deviceWidth: 414, deviceHeight: 896, ratio: 3 },
  { width: 1284, height: 2778, deviceWidth: 428, deviceHeight: 926, ratio: 3 },
  { width: 1290, height: 2796, deviceWidth: 430, deviceHeight: 932, ratio: 3 },
  { width: 1320, height: 2868, deviceWidth: 440, deviceHeight: 956, ratio: 3 },
  { width: 1536, height: 2048, deviceWidth: 768, deviceHeight: 1024, ratio: 2 },
  { width: 1668, height: 2388, deviceWidth: 834, deviceHeight: 1194, ratio: 2 },
  { width: 2048, height: 2732, deviceWidth: 1024, deviceHeight: 1366, ratio: 2 },
] as const;

export function appleSplashMedia(spec: (typeof APPLE_SPLASH)[number], orientation: "portrait" | "landscape") {
  const width = orientation === "portrait" ? spec.deviceWidth : spec.deviceHeight;
  const height = orientation === "portrait" ? spec.deviceHeight : spec.deviceWidth;
  return `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${spec.ratio}) and (orientation: ${orientation})`;
}
