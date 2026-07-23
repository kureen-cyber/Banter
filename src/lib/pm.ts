/**
 * Deep-link helpers for the custom PM platform (Firebase/Firestore).
 * Accounts link across apps via shared Firebase UID and/or GitHub handle.
 */

export function getPmBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_PM_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

export function pmTaskDeepLink(projectId: string, taskId: string) {
  return `${getPmBaseUrl()}/projects/${projectId}/tasks/${taskId}`;
}

export function pmProjectDeepLink(projectId: string) {
  return `${getPmBaseUrl()}/projects/${projectId}`;
}

/** Open PM profile / home keyed by GitHub handle when available. */
export function pmHomeDeepLink(githubHandle?: string | null) {
  const base = getPmBaseUrl();
  if (!githubHandle) return base;
  return `${base}/u/${encodeURIComponent(githubHandle)}`;
}

/** URL the PM app should open after Firebase login to enter Banter. */
export function banterPmHandoffUrl(idToken: string, githubHandle?: string | null) {
  const banter =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const params = new URLSearchParams({ idToken });
  if (githubHandle) params.set("github", githubHandle);
  return `${banter}/auth/pm?${params.toString()}`;
}
