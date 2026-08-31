import type { Analysis, ContextId, FamiliarityId } from "./engine/types";
import type { ExcludedMessages, SpeakerAssignments } from "./group-chat";

/**
 * Keeps an unfinished result alive while the user moves between Read and
 * Archive. This deliberately stays in memory: conversation text is not put in
 * localStorage unless the user explicitly chooses Save to archive.
 */
export type ActiveRead = {
  contentKind?: "conversation" | "post";
  raw: string;
  analyzedRaw?: string;
  context: ContextId;
  familiarity: FamiliarityId;
  youName: string | null;
  focusName: string | null;
  otherName: string;
  speakerAssignments: SpeakerAssignments;
  excludedMessages: ExcludedMessages;
  customParticipants: string[];
  analysis: Analysis;
  savedArchiveId?: string;
};

let currentRead: ActiveRead | null = null;

export function keepActiveRead(read: ActiveRead): void {
  currentRead = read;
}

export function readActiveRead(): ActiveRead | null {
  return currentRead;
}

export function clearActiveRead(): void {
  currentRead = null;
}

export function hasActiveRead(): boolean {
  return currentRead !== null;
}
