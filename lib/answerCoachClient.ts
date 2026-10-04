import { withBase } from "./basePath";
import { COACH_CLIENT_TIMEOUT_MS } from "./coach-budget";
import type { CoachGoalId, CoachToneId, PersonalizedCoachResult } from "./engine/answerCoach";
import type { ContextId, FamiliarityId } from "./engine/types";
import type { PlayEntitlementProof } from "./playBilling";
import { getFreeAnswerAceSession } from "./freeAnswerAceClient";
import { checkoutAction } from "./solanaCheckoutClient";

export async function requestPersonalizedCoach(input: {
  text: string;
  context: ContextId;
  familiarity: FamiliarityId;
  youName?: string;
  goal: CoachGoalId;
  tone: CoachToneId;
  stakes?: string;
  entitlement?: PlayEntitlementProof | null;
  inputKind?: "conversation" | "message";
}): Promise<PersonalizedCoachResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(new DOMException("AnswerAce timed out", "TimeoutError")),
    COACH_CLIENT_TIMEOUT_MS,
  );
  try {
    let freeToken: string | undefined;
    if (!input.entitlement) {
      const session = await getFreeAnswerAceSession();
      if (!session.ok || !session.token) return { ok: false, reason: session.reason || "Free AnswerAce is unavailable." };
      if (session.remaining === 0) {
        let paid = false;
        try { paid = (await checkoutAction<{ ok: boolean; active: boolean }>("entitlement")).active; } catch { /* The server still checks access. */ }
        if (!paid) return { ok: false, reason: "Your three free AnswerAce uses are used or running this month. Local reads remain free. An active pass or subscription can be restored from AnswerAce plans." };
      }
      freeToken = session.token;
    }
    const response = await fetch(withBase("/api/answer-coach"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, freeToken }),
      signal: controller.signal,
    });
    return await response.json() as PersonalizedCoachResult;
  } catch {
    return { ok: false, reason: controller.signal.aborted
      ? "AnswerAce took too long to respond. Your local analysis remains available; try again shortly."
      : "Could not reach AnswerAce. Your local analysis remains available." };
  } finally {
    window.clearTimeout(timer);
  }
}
