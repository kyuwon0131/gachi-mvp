import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "gachi.db");
const BANK_PATH = path.join(process.cwd(), "data", "question_bank.json");

interface BankApplicability {
  requires_marriage: boolean;
  requires_children: boolean;
  career_type: string[];
}

interface BankQuestion {
  id: number;
  question_ko: string;
  question_ja: string;
  applicability?: BankApplicability;
  themes?: string[];
  persona_variant_of?: number;
}

interface BankStage {
  life_stage_id: number;
  life_stage_ko: string;
  life_stage_ja: string;
  questions: BankQuestion[];
}

declare global {
  // eslint-disable-next-line no-var
  var __gachiDb: DatabaseSync | undefined;
}

function createSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      life_stage_id INTEGER NOT NULL,
      life_stage_ko TEXT NOT NULL,
      life_stage_ja TEXT NOT NULL,
      question_ko TEXT NOT NULL,
      question_ja TEXT NOT NULL,
      requires_marriage INTEGER NOT NULL DEFAULT 0,
      requires_children INTEGER NOT NULL DEFAULT 0,
      career_type TEXT NOT NULL DEFAULT '["any"]',
      themes_json TEXT NOT NULL DEFAULT '[]',
      persona_variant_of INTEGER
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL DEFAULT 'default-session',
      question_id INTEGER REFERENCES questions(id),
      life_stage_id INTEGER NOT NULL,
      question_ko TEXT NOT NULL,
      transcript TEXT NOT NULL,
      chapter TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      session_id TEXT PRIMARY KEY,
      gender TEXT,
      marital_status TEXT,
      has_children INTEGER,
      career_type TEXT,
      birth_year_range TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Idempotent column additions for DBs created before this migration.
  const addColumnIfMissing = (table: string, columnDef: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch {
      // column already exists — fine
    }
  };
  addColumnIfMissing("questions", "requires_marriage INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("questions", "requires_children INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("questions", `career_type TEXT NOT NULL DEFAULT '["any"]'`);
  addColumnIfMissing("questions", "themes_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing("questions", "persona_variant_of INTEGER");
  addColumnIfMissing("entries", "session_id TEXT NOT NULL DEFAULT 'default-session'");
}

function seedQuestions(db: DatabaseSync) {
  const bank: BankStage[] = JSON.parse(fs.readFileSync(BANK_PATH, "utf-8"));
  const bankRowCount = bank.reduce((sum, s) => sum + s.questions.length, 0);

  const existingCount = (
    db.prepare("SELECT COUNT(*) as count FROM questions").get() as {
      count: number;
    }
  ).count;

  // Reseed whenever the bank file's row count doesn't match what's stored —
  // covers first run (0 rows) and bank upgrades (e.g. persona variants added).
  // Base question ids (1..N) are stable across bank versions, and entries.question_id
  // references stay valid since we never renumber existing base questions.
  if (existingCount === bankRowCount) return;

  db.exec("DELETE FROM questions");
  const insert = db.prepare(
    `INSERT INTO questions
       (id, life_stage_id, life_stage_ko, life_stage_ja, question_ko, question_ja,
        requires_marriage, requires_children, career_type, themes_json, persona_variant_of)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const stage of bank) {
    for (const q of stage.questions) {
      const applicability = q.applicability ?? {
        requires_marriage: false,
        requires_children: false,
        career_type: ["any"],
      };
      insert.run(
        q.id,
        stage.life_stage_id,
        stage.life_stage_ko,
        stage.life_stage_ja,
        q.question_ko,
        q.question_ja,
        applicability.requires_marriage ? 1 : 0,
        applicability.requires_children ? 1 : 0,
        JSON.stringify(applicability.career_type ?? ["any"]),
        JSON.stringify(q.themes ?? []),
        q.persona_variant_of ?? null
      );
    }
  }
}

/** Singleton connection, cached on globalThis so Next.js dev hot-reload
 * doesn't reopen (and re-lock) the sqlite file on every request. */
export function getDb(): DatabaseSync {
  if (!global.__gachiDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    createSchema(db);
    seedQuestions(db);
    global.__gachiDb = db;
  }
  return global.__gachiDb;
}
