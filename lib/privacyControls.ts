import { clearActiveRead } from "./active-read";
import {clearContinuedRead} from './conversation-continuity';
import { BASE_PATH } from "./basePath";
import { ERASE_WORKSPACE_EVENT } from "./workspace-lifetime";
import { clearFreeAnswerAceIdentity } from "./freeAnswerAceClient";

const SUBTEXT_LOCAL_KEYS = new Set([
  "subtext_local_profile_v1",
  "subtext_conversation_archive_v1",
  "subtext.usage.v1",
  "subtext.healthy-closure.v2",
  "subtext.reflection-progress.v1",
  "subtext.product-events.v1",
]);

const SUBTEXT_SESSION_KEYS = new Set(["sbtCapDismiss"]);
const SUBTEXT_CACHE_PREFIX = "subtext-shell-";

function removeMatchingKeys(storage: Storage, exactKeys: Set<string>, prefixes: string[]): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (exactKeys.has(key) || prefixes.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}

/** Removes Subtext-owned state without touching Resolve, TrackGap, or other origin data. */
export async function eraseAllSubtextData(): Promise<void> {
  if (typeof window === "undefined") return;

  clearActiveRead();
  clearContinuedRead();
  clearFreeAnswerAceIdentity();
  // Erasure must also clear retained UI and invalidate pending OCR/Coach work.
  window.dispatchEvent(new Event(ERASE_WORKSPACE_EVENT));
  removeMatchingKeys(window.localStorage, SUBTEXT_LOCAL_KEYS, ["subtext.", "subtext_"]);
  removeMatchingKeys(window.sessionStorage, SUBTEXT_SESSION_KEYS, ["subtext.", "subtext_", "sbt"]);

  if ("caches" in window) {
    const keys = await window.caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(SUBTEXT_CACHE_PREFIX))
        .map((key) => window.caches.delete(key)),
    );
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const expectedScriptPath = `${BASE_PATH || ""}/sw.js`.replace(/\/+/g, "/");
    await Promise.all(
      registrations
        .filter((registration) => {
          try {
            const worker = registration.active ?? registration.waiting ?? registration.installing;
            return Boolean(worker && new URL(worker.scriptURL).pathname === expectedScriptPath);
          } catch {
            return false;
          }
        })
        .map((registration) => registration.unregister()),
    );
  }
}
