import { describe, expect, it } from "vitest";
import { parseDecisionRequest } from "./decision-request";

describe("parseDecisionRequest", () => {
  it("parses Korean multiline options where text continues on next line", () => {
    const content = [
      ".  :",
      "1.",
      "QA",
      "2.",
      "/   QA",
    ].join("\n");

    const parsed = parseDecisionRequest(content);
    expect(parsed).not.toBeNull();
    expect(parsed?.options).toEqual([
      { number: 1, label: "QA" },
      { number: 2, label: "/   QA" },
    ]);
  });

  it("parses inline English options", () => {
    const content = [
      "Decision needed. Choose one option:",
      "1) Continue QA on current workspace",
      "2) Reset to baseline branch and rerun QA",
    ].join("\n");

    const parsed = parseDecisionRequest(content);
    expect(parsed?.options).toEqual([
      { number: 1, label: "Continue QA on current workspace" },
      { number: 2, label: "Reset to baseline branch and rerun QA" },
    ]);
  });

  it("returns null for normal numbered notes without decision hints", () => {
    const content = ["TODO", "1. lint", "2. test", "3."].join("\n");

    expect(parseDecisionRequest(content)).toBeNull();
  });
});
