import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { initializeCollabLanguagePolicy } from "./language-policy.ts";

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ko TEXT NOT NULL DEFAULT '',
      name_ja TEXT NOT NULL DEFAULT '',
      name_zh TEXT NOT NULL DEFAULT ''
    );
  `);
  return db;
}

describe("language-policy detectTargetDepartments", () => {
  it("( )", () => {
    const db = setupDb();
    try {
      db.prepare("INSERT INTO settings (key, value) VALUES ('language', '\"ko\"')").run();
      db.prepare(
        "INSERT INTO departments (id, name, name_ko, name_ja, name_zh) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
      ).run(
        "planning",
        "Pre-production",
        "",
        "プリプロ班",
        "前期策划组",
        "dev",
        "Scene Engine",
        "",
        "シーン設計",
        "场景引擎组",
      );

      const { detectTargetDepartments } = initializeCollabLanguagePolicy({ db });
      const found = detectTargetDepartments("");

      expect(found).toContain("planning");
      expect(found).toContain("dev");
    } finally {
      db.close();
    }
  });

  it("/", () => {
    const db = setupDb();
    try {
      db.prepare("INSERT INTO settings (key, value) VALUES ('language', '\"ko\"')").run();
      db.prepare("INSERT INTO departments (id, name, name_ko, name_ja, name_zh) VALUES (?, ?, ?, ?, ?)").run(
        "planning",
        "Pre-production",
        "",
        "プリプロ班",
        "前期策划组",
      );

      const { detectTargetDepartments } = initializeCollabLanguagePolicy({ db });
      const found = detectTargetDepartments("");

      expect(found).toContain("planning");
    } finally {
      db.close();
    }
  });
});
