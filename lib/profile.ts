import { getDb } from "./db";

export type CareerType =
  | "corporate"
  | "self_employed"
  | "homemaker"
  | "farmer"
  | "other";

export interface UserProfile {
  sessionId: string;
  gender: "male" | "female" | "unspecified";
  maritalStatus: "married" | "unmarried" | "unspecified";
  hasChildren: boolean | null; // null = unspecified
  careerType: CareerType;
  birthYearRange: string; // e.g. "1950s"
}

interface ProfileRow {
  session_id: string;
  gender: string | null;
  marital_status: string | null;
  has_children: number | null;
  career_type: string | null;
  birth_year_range: string | null;
}

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    sessionId: row.session_id,
    gender: (row.gender as UserProfile["gender"]) ?? "unspecified",
    maritalStatus:
      (row.marital_status as UserProfile["maritalStatus"]) ?? "unspecified",
    hasChildren: row.has_children === null ? null : row.has_children === 1,
    careerType: (row.career_type as CareerType) ?? "other",
    birthYearRange: row.birth_year_range ?? "",
  };
}

export function getProfile(sessionId: string): UserProfile | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM user_profile WHERE session_id = ?")
    .get(sessionId) as ProfileRow | undefined;
  return row ? rowToProfile(row) : null;
}

export function saveProfile(
  sessionId: string,
  input: {
    gender: UserProfile["gender"];
    maritalStatus: UserProfile["maritalStatus"];
    hasChildren: boolean | null;
    careerType: CareerType;
    birthYearRange: string;
  }
): UserProfile {
  const db = getDb();
  db.prepare(
    `INSERT INTO user_profile (session_id, gender, marital_status, has_children, career_type, birth_year_range)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       gender = excluded.gender,
       marital_status = excluded.marital_status,
       has_children = excluded.has_children,
       career_type = excluded.career_type,
       birth_year_range = excluded.birth_year_range`
  ).run(
    sessionId,
    input.gender,
    input.maritalStatus,
    input.hasChildren === null ? null : input.hasChildren ? 1 : 0,
    input.careerType,
    input.birthYearRange
  );
  return {
    sessionId,
    gender: input.gender,
    maritalStatus: input.maritalStatus,
    hasChildren: input.hasChildren,
    careerType: input.careerType,
    birthYearRange: input.birthYearRange,
  };
}
