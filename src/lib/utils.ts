import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Extract @mentions like @Kureen from message body */
export function extractMentions(body: string): string[] {
  const matches = body.match(/@([A-Za-z0-9_.-]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}
