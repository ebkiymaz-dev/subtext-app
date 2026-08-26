import { withBase } from "./basePath";
import { COACH_CLIENT_TIMEOUT_MS } from "./coach-budget";
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
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(new DOMException("Answer Coach timed out", "TimeoutError")),
    COACH_CLIENT_TIMEOUT_MS,
  );
  try {
    const response = await fetch(withBase("/api/answer-coach"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    return await response.json() as PersonalizedCoachResult;
  } catch {
    return { ok: false, reason: controller.signal.aborted
      ? "Answer Coach took too long to respond. Your local analysis remains available; try again shortly."
      : "Could not reach Answer Coach. Your local analysis remains available." };
  } finally {
    window.clearTimeout(timer);
  }
}
