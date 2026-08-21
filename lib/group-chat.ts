import type { Transcript } from "./engine/types";

export type SpeakerAssignments = Record<string, string>;
export type ExcludedMessages = Record<string, boolean>;

export type ParticipantStat = {
  name: string;
  messages: number;
  words: number;
  share: number;
};

export function assignedName(
  message: Transcript["messages"][number],
  assignments: SpeakerAssignments
): string {
  return assignments[message.id]?.trim() || message.name;
}

export function availableParticipants(
  transcript: Transcript | null,
  assignments: SpeakerAssignments,
  custom: string[] = []
): string[] {
  if (!transcript) return custom.filter(Boolean);
  return [...new Set([
    ...transcript.messages.map((message) => message.name),
    ...transcript.messages.map((message) => assignedName(message, assignments)),
    ...custom.map((name) => name.trim()),
  ].filter(Boolean))];
}

export function activeParticipants(
  transcript: Transcript | null,
  assignments: SpeakerAssignments,
  excluded: ExcludedMessages
): string[] {
  if (!transcript) return [];
  return [...new Set(
    transcript.messages
      .filter((message) => !excluded[message.id])
      .map((message) => assignedName(message, assignments))
  )];
}

export function focusedTranscript(
  transcript: Transcript,
  assignments: SpeakerAssignments,
  excluded: ExcludedMessages,
  youName: string,
  focusName: string,
  youDisplayName = youName,
  focusDisplayName = focusName
): string {
  return transcript.messages
    .filter((message) => !excluded[message.id])
    .map((message) => ({ ...message, assigned: assignedName(message, assignments) }))
    .filter((message) => message.assigned === youName || message.assigned === focusName)
    .map((message) => `${message.assigned === youName ? youDisplayName : focusDisplayName}: ${message.text}`)
    .join("\n");
}

export function participantStats(
  transcript: Transcript | null,
  assignments: SpeakerAssignments,
  excluded: ExcludedMessages
): ParticipantStat[] {
  if (!transcript) return [];
  const counts = new Map<string, { messages: number; words: number }>();
  for (const message of transcript.messages) {
    if (excluded[message.id]) continue;
    const name = assignedName(message, assignments);
    const current = counts.get(name) ?? { messages: 0, words: 0 };
    current.messages += 1;
    current.words += message.text.trim().split(/\s+/).filter(Boolean).length;
    counts.set(name, current);
  }
  const total = [...counts.values()].reduce((sum, item) => sum + item.messages, 0);
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      ...count,
      share: total ? Math.round((count.messages / total) * 100) : 0,
    }))
    .sort((a, b) => b.messages - a.messages || a.name.localeCompare(b.name));
}
