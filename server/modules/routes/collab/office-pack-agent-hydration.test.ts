import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  hydrateOfficePackAgentFromSettings,
  syncOfficePackAgentsForPack,
  syncOfficePackAgentsFromProfiles,
} from "./office-pack-agent-hydration.ts";

function createDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ko TEXT NOT NULL,
      name_ja TEXT NOT NULL DEFAULT '',
      name_zh TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '🏢',
      color TEXT NOT NULL DEFAULT '#64748b',
      description TEXT,
      prompt TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()*1000)
    );

    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ko TEXT NOT NULL,
      department_id TEXT,
      role TEXT NOT NULL,
      acts_as_planning_leader INTEGER NOT NULL DEFAULT 0,
      cli_provider TEXT,
      avatar_emoji TEXT NOT NULL DEFAULT '🤖',
      personality TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      current_task_id TEXT,
      stats_tasks_done INTEGER DEFAULT 0,
      stats_xp INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()*1000),
      oauth_account_id TEXT,
      api_provider_id TEXT,
      api_model TEXT,
      sprite_number INTEGER,
      name_ja TEXT NOT NULL DEFAULT '',
      name_zh TEXT NOT NULL DEFAULT '',
      cli_model TEXT,
      cli_reasoning_level TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );
  `);
  return db;
}

let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe("hydrateOfficePackAgentFromSettings", () => {
  it("officePackProfiles  seed  DB", () => {
    db = createDb();
    const profiles = {
      video_preprod: {
        departments: [
          {
            id: "planning",
            name: "Planning",
            name_ko: "",
            name_ja: "企画",
            name_zh: "企划",
            icon: "🎬",
            color: "#f59e0b",
            sort_order: 1,
            created_at: 1700000000000,
          },
        ],
        agents: [
          {
            id: "video_preprod-seed-1",
            name: "Rian",
            name_ko: "",
            name_ja: "リアン",
            name_zh: "里安",
            department_id: "planning",
            role: "team_leader",
            acts_as_planning_leader: 1,
            cli_provider: "claude",
            cli_model: "claude-opus-4-6",
            avatar_emoji: "🎬",
            sprite_number: 8,
            personality: "planning lead",
            created_at: 1700000000001,
          },
        ],
      },
    };
    db.prepare("INSERT INTO settings (key, value) VALUES ('officePackProfiles', ?)").run(JSON.stringify(profiles));

    const hydrated = hydrateOfficePackAgentFromSettings(db, "video_preprod-seed-1", () => 1700000000999);
    expect(hydrated?.id).toBe("video_preprod-seed-1");
    expect(hydrated?.name).toBe("Rian");
    expect(hydrated?.department_id).toBe("planning");
    expect(hydrated?.cli_provider).toBe("claude");
    expect(hydrated?.cli_model).toBe("claude-opus-4-6");
    expect((hydrated as unknown as { sprite_number?: number }).sprite_number).toBe(8);
    expect((hydrated as unknown as { acts_as_planning_leader?: number }).acts_as_planning_leader).toBe(1);

    const dept = db.prepare("SELECT id, name_ko FROM departments WHERE id = 'planning'").get() as
      | { id: string; name_ko: string }
      | undefined;
    expect(dept).toEqual({ id: "planning", name_ko: "" });
  });

  it("agent id null", () => {
    db = createDb();
    db.prepare("INSERT INTO settings (key, value) VALUES ('officePackProfiles', ?)").run(JSON.stringify({}));

    const hydrated = hydrateOfficePackAgentFromSettings(db, "missing-agent", () => 1700000000999);
    expect(hydrated).toBeNull();
  });

  it("profiles   sync seed  agents", () => {
    db = createDb();
    const profiles = {
      novel: {
        departments: [
          {
            id: "design",
            name: "Story Design",
            name_ko: "",
            icon: "✍️",
            color: "#7c3aed",
            sort_order: 1,
          },
        ],
        agents: [
          {
            id: "novel-seed-1",
            name: "Luna",
            name_ko: "",
            department_id: "design",
            role: "team_leader",
            acts_as_planning_leader: 1,
            cli_provider: "claude",
            avatar_emoji: "✍️",
          },
        ],
      },
    };

    const result = syncOfficePackAgentsFromProfiles(db, profiles, () => 1700000002000);
    expect(result.agentsSynced).toBeGreaterThan(0);

    const row = db
      .prepare("SELECT id, name, department_id, acts_as_planning_leader FROM agents WHERE id = 'novel-seed-1'")
      .get() as { id: string; name: string; department_id: string | null; acts_as_planning_leader: number } | undefined;
    expect(row).toEqual({
      id: "novel-seed-1",
      name: "Luna",
      department_id: "design",
      acts_as_planning_leader: 1,
    });
  });

  it("pack  sync   hydrate", () => {
    db = createDb();
    const profiles = {
      novel: {
        departments: [{ id: "design", name: "Story Design", name_ko: "", icon: "✍️", color: "#7c3aed" }],
        agents: [
          {
            id: "novel-seed-1",
            name: "Luna",
            name_ko: "",
            department_id: "design",
            role: "team_leader",
            cli_provider: "claude",
            avatar_emoji: "✍️",
          },
        ],
      },
      report: {
        departments: [{ id: "planning", name: "Report", name_ko: "", icon: "📚", color: "#f59e0b" }],
        agents: [
          {
            id: "report-seed-1",
            name: "Sage",
            name_ko: "",
            department_id: "planning",
            role: "team_leader",
            cli_provider: "claude",
            avatar_emoji: "📚",
          },
        ],
      },
    };

    const result = syncOfficePackAgentsForPack(db, profiles, "novel", () => 1700000003000);
    expect(result.agentsSynced).toBeGreaterThan(0);

    const novel = db.prepare("SELECT id FROM agents WHERE id = 'novel-seed-1'").get() as { id?: string } | undefined;
    const report = db.prepare("SELECT id FROM agents WHERE id = 'report-seed-1'").get() as { id?: string } | undefined;

    expect(novel?.id).toBe("novel-seed-1");
    expect(report).toBeUndefined();
  });
});
