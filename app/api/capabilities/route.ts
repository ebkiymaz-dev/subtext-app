// ═════════════════════════════════════════════════════════════
// GET /api/capabilities
//
// The ONLY place `lib/providers` may be imported from. That module reads
// process.env for names like GROQ_API_KEY; this Route Handler is server-only,
// so those values never reach the browser bundle.
//
// The response is booleans, labels, limits and signup URLs — never a key.
//
// Note for this app specifically: NO message text is sent here, ever. This
// endpoint reports configuration state only, which is what keeps "your
// conversation never touches our server" true even with a provider connected.
// ═════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { capabilityReport, resolveCoachProvider } from "@/lib/providers";

// Read the environment per request, so pasting a key and restarting is enough
// to see the state change.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const report = capabilityReport();
    const coach = resolveCoachProvider();
    return NextResponse.json({
      ...report,
      coachProvider: {
        configured: coach.configured,
        label: coach.label,
        privacy: coach.privacy,
      },
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { app: "subtext", state: "unknown", capabilities: {}, connectToUnlock: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
