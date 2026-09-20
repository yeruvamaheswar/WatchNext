export function posterUrl(
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "w780" | "original" = "w500"
) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path.replace(/^http:\/\//i, "https://");
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${normalized}`;
}

export function backdropUrl(path: string | null | undefined) {
  return posterUrl(path, "w780");
}
