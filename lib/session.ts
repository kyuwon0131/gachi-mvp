import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const COOKIE_NAME = "gachi_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Reads the session id cookie, or generates a fresh one if absent.
 * Caller is responsible for attaching it to the outgoing response via
 * `attachSessionCookie` so the browser remembers it on the next request. */
export function readOrCreateSessionId(req: NextRequest): {
  sessionId: string;
  isNew: boolean;
} {
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (existing) return { sessionId: existing, isNew: false };
  return { sessionId: crypto.randomUUID(), isNew: true };
}

export function attachSessionCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(COOKIE_NAME, sessionId, {
    maxAge: ONE_YEAR,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
