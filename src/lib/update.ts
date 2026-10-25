import type { Update } from "@tauri-apps/plugin-updater";

/**
 * Selbst-Update ueber GitHub-Releases (`latest.json`, siehe tauri.conf.json).
 * Nur in der installierten Desktop-App: im Browser gibt es kein Tauri, und der
 * Dev-Build hinkt nach jedem Release bis zum Release-Bump-Commit hinterher --
 * ohne die Sperre boete er an, den Installer ueber die Entwicklungsumgebung zu ziehen.
 */
export async function findUpdate(): Promise<Update | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  if (import.meta.env.DEV) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  return check();
}

/** Endet im Erfolgsfall im Neustart -- danach laeuft nichts mehr. */
export async function installUpdate(
  update: Update,
  onProgress: (fraction: number) => void,
): Promise<void> {
  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? 0;
    } else if (event.event === "Progress") {
      received += event.data.chunkLength;
      if (total > 0) onProgress(received / total);
    }
  });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
