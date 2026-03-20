import { describe, expect, it } from "vitest";
import { buildWorkflowPackExecutionGuidance } from "./execution-guidance.ts";

describe("buildWorkflowPackExecutionGuidance", () => {
  it("video_preprod remotion   mp4", () => {
    const guidance = buildWorkflowPackExecutionGuidance("video_preprod", "ko", {
      videoArtifactRelativePath: "video_output/VID__final.mp4",
    });
    expect(guidance).toContain("video_output/VID__final.mp4");
    expect(guidance).toContain("");
    expect(guidance).toContain("remotion render");
    expect(guidance).toContain("pnpm exec remotion browser ensure");
    expect(guidance).toContain("[High Quality Direction]");
    expect(guidance).toContain("8~12");
  });

  it("video_preprod", () => {
    expect(buildWorkflowPackExecutionGuidance("development", "ko")).toBe("");
    expect(buildWorkflowPackExecutionGuidance("report", "en")).toBe("");
  });

  it("", () => {
    const guidance = buildWorkflowPackExecutionGuidance("video_preprod", null);
    expect(guidance).toContain("Fixed order:");
  });
});
