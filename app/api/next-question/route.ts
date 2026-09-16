import { NextRequest, NextResponse } from "next/server";
import { readOrCreateSessionId, attachSessionCookie } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { pickNextQuestion, getProgressSummary } from "@/lib/questions";

export async function GET(req: NextRequest) {
  const { sessionId } = readOrCreateSessionId(req);
  const profile = getProfile(sessionId);

  const question = pickNextQuestion(sessionId, profile);
  const progress = getProgressSummary(sessionId, profile);

  const res = NextResponse.json(
    question
      ? {
          done: false,
          nextQuestion: {
            id: question.id,
            life_stage_id: question.life_stage_id,
            life_stage_ko: question.life_stage_ko,
            life_stage_ja: question.life_stage_ja,
            question_ko: question.question_ko,
            question_ja: question.question_ja,
          },
          progress,
        }
      : { done: true, nextQuestion: null, progress }
  );
  return attachSessionCookie(res, sessionId);
}
