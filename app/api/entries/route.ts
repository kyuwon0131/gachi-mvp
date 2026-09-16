import { NextRequest, NextResponse } from "next/server";
import { readOrCreateSessionId, attachSessionCookie } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { getAllEntries, getProgressSummary, TOTAL_STAGES } from "@/lib/questions";

export async function GET(req: NextRequest) {
  const { sessionId } = readOrCreateSessionId(req);
  const profile = getProfile(sessionId);

  const entries = getAllEntries(sessionId);
  const progress = getProgressSummary(sessionId, profile);

  const stageIds = new Set(entries.map((e) => e.life_stage_id));

  const res = NextResponse.json({
    entries,
    progress: {
      ...progress,
      stagesStarted: stageIds.size,
      totalStages: TOTAL_STAGES,
    },
  });
  return attachSessionCookie(res, sessionId);
}
