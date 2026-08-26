import type { CategoryScore, ContextId, FamiliarityId } from "./engine/types";

const PROFILE_KEY = "subtext_local_profile_v1";
const ARCHIVE_KEY = "subtext_conversation_archive_v1";

export type LocalProfile = {
  id: string;
  name: string;
  createdAt: string;
};

export type ArchivedConversation = {
  id: string;
  profileId: string;
  title: string;
  otherName: string;
  raw: string;
  context: ContextId;
  familiarity: FamiliarityId;
  headline: string;
  categories: Pick<CategoryScore, "id" | "label" | "percent" | "read">[];
  createdAt: string;
};

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function readLocalProfile(): LocalProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? "null") as LocalProfile | null;
    return value?.id && value.name ? value : null;
  } catch {
    return null;
  }
}

export function createLocalProfile(name: string): LocalProfile {
  const profile = { id: makeId(), name: name.trim(), createdAt: new Date().toISOString() };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function deleteLocalProfile(): void {
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(ARCHIVE_KEY);
}

export function readArchive(): ArchivedConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(ARCHIVE_KEY) ?? "[]") as ArchivedConversation[];
    return Array.isArray(value) ? value.filter((item) => item?.id && item?.raw).slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function saveArchivedConversation(
  profile: LocalProfile,
  input: Omit<ArchivedConversation, "id" | "profileId" | "createdAt">
): ArchivedConversation {
  const existing = readArchive();
  // Repeated taps or returning from Archive must not create another copy.
  const duplicate = existing.find((item) => item.profileId === profile.id
    && item.raw === input.raw && item.context === input.context
    && item.familiarity === input.familiarity && item.otherName === input.otherName);
  if (duplicate) return duplicate;
  const item: ArchivedConversation = {
    ...input,
    id: makeId(),
    profileId: profile.id,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...existing].slice(0, 100);
  window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  return item;
}

export function deleteArchivedConversation(id: string): ArchivedConversation[] {
  const next = readArchive().filter((item) => item.id !== id);
  window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  return next;
}
