import { NextRequest, NextResponse } from "next/server";
import { readOrCreateSessionId, attachSessionCookie } from "@/lib/session";
import { getProfile, saveProfile, type CareerType } from "@/lib/profile";

export async function GET(req: NextRequest) {
  const { sessionId, isNew } = readOrCreateSessionId(req);
  const profile = isNew ? null : getProfile(sessionId);
  const res = NextResponse.json({ profile });
  return attachSessionCookie(res, sessionId);
}

export async function POST(req: NextRequest) {
  const { sessionId } = readOrCreateSessionId(req);
  const body = (await req.json()) as {
    gender: "male" | "female" | "unspecified";
    maritalStatus: "married" | "unmarried" | "unspecified";
    hasChildren: boolean | null;
    careerType: CareerType;
    birthYearRange: string;
  };

  const profile = saveProfile(sessionId, body);
  const res = NextResponse.json({ profile });
  return attachSessionCookie(res, sessionId);
}
