import { getDb } from "./db";
import type { UserProfile, CareerType } from "./profile";

export const TOTAL_STAGES = 10;

export interface QuestionRow {
  id: number;
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  question_ko: string;
  question_ja: string;
  requires_marriage: boolean;
  requires_children: boolean;
  career_type: string[];
  themes: string[];
  persona_variant_of: number | null;
}

export interface EntryRow {
  id: number;
  session_id: string;
  question_id: number | null;
  life_stage_id: number;
  question_ko: string;
  transcript: string;
  chapter: string;
  created_at: string;
}

interface RawQuestionRow {
  id: number;
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  question_ko: string;
  question_ja: string;
  requires_marriage: number;
  requires_children: number;
  career_type: string;
  themes_json: string;
  persona_variant_of: number | null;
}

function toQuestionRow(row: RawQuestionRow): QuestionRow {
  return {
    id: row.id,
    life_stage_id: row.life_stage_id,
    life_stage_ko: row.life_stage_ko,
    life_stage_ja: row.life_stage_ja,
    question_ko: row.question_ko,
    question_ja: row.question_ja,
    requires_marriage: row.requires_marriage === 1,
    requires_children: row.requires_children === 1,
    career_type: JSON.parse(row.career_type) as string[],
    themes: JSON.parse(row.themes_json) as string[],
    persona_variant_of: row.persona_variant_of,
  };
}

export const slotId = (q: QuestionRow): number => q.persona_variant_of ?? q.id;

/** True if the question's hard requirements (marriage/children) are satisfied
 * by the profile. Missing/unspecified profile info is treated permissively —
 * we only exclude on an explicit mismatch, never on "we don't know yet". */
function passesHardFilters(q: QuestionRow, profile: UserProfile | null): boolean {
  if (q.requires_marriage && profile?.maritalStatus === "unmarried") return false;
  if (q.requires_children && profile?.hasChildren === false) return false;
  return true;
}

/** Within a slot's variant rows, pick the one that best matches the profile's
 * career type; fall back to the "any" (base) row. */
function pickBestVariant(rows: QuestionRow[], careerType: CareerType | undefined): QuestionRow {
  if (careerType) {
    const exact = rows.find((r) => r.career_type.includes(careerType));
    if (exact) return exact;
  }
  const generic = rows.find((r) => r.career_type.includes("any"));
  return generic ?? rows[0];
}

function getRawStageRows(stageId: number): QuestionRow[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM questions WHERE life_stage_id = ? ORDER BY id")
    .all(stageId) as unknown as RawQuestionRow[];
  return rows.map(toQuestionRow);
}

/** One representative question per eligible, unanswered "slot" in this stage,
 * selecting the variant that best matches the user's profile. */
export function getRemainingQuestions(
  stageId: number,
  sessionId: string,
  profile: UserProfile | null
): QuestionRow[] {
  const db = getDb();
  const answeredSlotIds = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT COALESCE(q.persona_variant_of, q.id) as slot_id
           FROM entries e JOIN questions q ON e.question_id = q.id
           WHERE e.session_id = ?`
        )
        .all(sessionId) as unknown as { slot_id: number }[]
    ).map((r) => r.slot_id)
  );

  const rows = getRawStageRows(stageId);
  const bySlot = new Map<number, QuestionRow[]>();
  for (const q of rows) {
    const sid = slotId(q);
    if (answeredSlotIds.has(sid)) continue;
    if (!passesHardFilters(q, profile)) continue;
    if (!bySlot.has(sid)) bySlot.set(sid, []);
    bySlot.get(sid)!.push(q);
  }

  const result: QuestionRow[] = [];
  for (const variants of bySlot.values()) {
    result.push(pickBestVariant(variants, profile?.careerType));
  }
  return result.sort((a, b) => slotId(a) - slotId(b));
}

/** Lowest-numbered life stage that still has unanswered eligible slots, or null if done. */
export function getCurrentStageId(
  sessionId: string,
  profile: UserProfile | null
): number | null {
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    if (getRemainingQuestions(stage, sessionId, profile).length > 0) return stage;
  }
  return null;
}

export function getQuestionById(id: number): QuestionRow | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as
    | RawQuestionRow
    | undefined;
  return row ? toQuestionRow(row) : undefined;
}

export function saveEntry(entry: {
  sessionId: string;
  questionId: number | null;
  lifeStageId: number;
  questionKo: string;
  transcript: string;
  chapter: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO entries (session_id, question_id, life_stage_id, question_ko, transcript, chapter)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    entry.sessionId,
    entry.questionId,
    entry.lifeStageId,
    entry.questionKo,
    entry.transcript,
    entry.chapter
  );
}

export function getAllEntries(sessionId: string): EntryRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM entries WHERE session_id = ? ORDER BY life_stage_id ASC, id ASC"
    )
    .all(sessionId) as unknown as EntryRow[];
}

/** Total eligible slots (106 minus any permanently filtered out by hard
 * profile mismatches) and how many of those this session has answered. */
export function getProgressSummary(sessionId: string, profile: UserProfile | null) {
  const db = getDb();
  const totalAnswered = (
    db
      .prepare("SELECT COUNT(*) as c FROM entries WHERE session_id = ?")
      .get(sessionId) as { c: number }
  ).c;

  let totalEligibleSlots = 0;
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    const rows = getRawStageRows(stage);
    const slots = new Set(
      rows.filter((q) => passesHardFilters(q, profile)).map(slotId)
    );
    totalEligibleSlots += slots.size;
  }

  return { totalAnswered, totalQuestions: totalEligibleSlots };
}

/** Pick the next question to ask: first unanswered eligible slot in the current stage. */
export function pickNextQuestion(
  sessionId: string,
  profile: UserProfile | null
): QuestionRow | null {
  const stageId = getCurrentStageId(sessionId, profile);
  if (stageId === null) return null;
  const remaining = getRemainingQuestions(stageId, sessionId, profile);
  return remaining[0] ?? null;
}

/** Themes that have come up most often in this session's answers so far,
 * used to weight which candidate question GPT should lean towards next. */
export function getDominantThemes(sessionId: string, limit = 3): string[] {
  const entries = getAllEntries(sessionId);
  if (entries.length === 0) return [];

  const tally = new Map<string, number>();
  for (const entry of entries) {
    const q = entry.question_id ? getQuestionById(entry.question_id) : undefined;
    if (!q) continue;
    for (const theme of q.themes) {
      tally.set(theme, (tally.get(theme) ?? 0) + 1);
    }
  }

  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([theme]) => theme);
}
