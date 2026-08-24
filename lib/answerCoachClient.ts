import { withBase } from "./basePath";
import type { CoachGoalId, CoachToneId, PersonalizedCoachResult } from "./engine/answerCoach";
import type { ContextId, FamiliarityId } from "./engine/types";
import type { PlayEntitlementProof } from "./playBilling";

export async function requestPersonalizedCoach(input: {
  text: string;
  context: ContextId;
  familiarity: FamiliarityId;
  youName?: string;
  goal: CoachGoalId;
  tone: CoachToneId;
  stakes?: string;
  entitlement: PlayEntitlementProof;
}): Promise<PersonalizedCoachResult> {
  try {
    const response = await fetch(withBase("/api/answer-coach"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return await response.json() as PersonalizedCoachResult;
  } catch {
    return { ok: false, reason: "Could not reach Answer Coach. Your local analysis remains available." };
  }
}
