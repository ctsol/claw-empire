import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  buildVideoArtifactFileName,
  resolveVideoArtifactRelativeCandidates,
  resolveVideoArtifactSpecForTask,
} from "./video-artifact.ts";

describe("video artifact naming", () => {
  it("+", () => {
    expect(buildVideoArtifactFileName("VID", "")).toBe("VID__final.mp4");
    expect(buildVideoArtifactFileName("  Demo Project  ", "Design Ops")).toBe("Demo_Project_Design_Ops_final.mp4");
  });

  it("task", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE departments (id TEXT PRIMARY KEY, name TEXT, name_ko TEXT);
      `);
      db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run("proj-1", "VID");
      db.prepare("INSERT INTO departments (id, name, name_ko) VALUES (?, ?, ?)").run("planning", "Planning", "");

      const spec = resolveVideoArtifactSpecForTask(db as any, {
        project_id: "proj-1",
        department_id: "planning",
        project_path: "/tmp/vid-project",
      });

      expect(spec.relativePath).toBe("video_output/VID__final.mp4");
      expect(resolveVideoArtifactRelativeCandidates(spec)).toEqual([
        "video_output/VID__final.mp4",
        "video_output/final.mp4",
        "out/VID__final.mp4",
        "out/final.mp4",
      ]);
    } finally {
      db.close();
    }
  });
});
