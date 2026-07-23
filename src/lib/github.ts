export function normalizeGithubHandle(raw: string | null | undefined) {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .split("/")[0]
    ?.toLowerCase();
  if (!cleaned || !/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}
