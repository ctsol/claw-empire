import { describe, expect, it } from "vitest";
import {
  detectProjectKindChoice,
  isAffirmativeReply,
  isNoPathReply,
  isProjectProgressInquiry,
  isTaskKickoffMessage,
  normalizeAgentReply,
  resolveContextualTaskMessage,
  shouldPreserveStructuredFallback,
  shouldTreatDirectChatAsTask,
} from "./direct-chat.ts";

describe("normalizeAgentReply", () => {
  it("1", () => {
    const input = "!  ,   !  ,";
    expect(normalizeAgentReply(input)).toBe("!  ,");
  });

  it("(A+B+C, A+B+C) 1", () => {
    const input =
      ",    ! ,   1 30…        ?   !  ,   1 30…        ?   !";
    expect(normalizeAgentReply(input)).toBe(
      ",    !  ,   1 30…        ?   !",
    );
  });

  it("", () => {
    const input = ",   10   .";
    expect(normalizeAgentReply(input)).toBe(input);
  });
});

describe("task intent upgrade", () => {
  it("task kickoff", () => {
    expect(isTaskKickoffMessage("")).toBe(true);
    expect(isTaskKickoffMessage("go go!")).toBe(true);
    expect(isTaskKickoffMessage("")).toBe(false);
  });

  it("", () => {
    expect(isAffirmativeReply("")).toBe(true);
    expect(isAffirmativeReply("yes, go ahead")).toBe(true);
    expect(isAffirmativeReply("はい、お願いします")).toBe(true);
    expect(isAffirmativeReply("好的，开始吧")).toBe(true);
    expect(isAffirmativeReply("")).toBe(false);
  });

  it("", () => {
    expect(isNoPathReply("")).toBe(true);
    expect(isNoPathReply("I don't have project path")).toBe(true);
    expect(isNoPathReply("新建项目吧")).toBe(true);
    expect(isNoPathReply("path")).toBe(false);
  });

  it("", () => {
    expect(detectProjectKindChoice("")).toBe("existing");
    expect(detectProjectKindChoice("")).toBe("existing");
    expect(detectProjectKindChoice("")).toBe("existing");
    expect(detectProjectKindChoice("2")).toBe("new");
    expect(detectProjectKindChoice("new project")).toBe("new");
    expect(detectProjectKindChoice("!")).toBe("new");
    expect(detectProjectKindChoice("")).toBe("new");
    expect(detectProjectKindChoice("2")).toBe("new");
    expect(detectProjectKindChoice("")).toBe("existing");
    expect(detectProjectKindChoice("")).toBeNull();
  });

  it("/   task", () => {
    expect(shouldTreatDirectChatAsTask("", "chat")).toBe(true);
    expect(shouldTreatDirectChatAsTask("", "chat")).toBe(true);
    expect(shouldTreatDirectChatAsTask("I need a design review report", "chat")).toBe(true);
    expect(shouldTreatDirectChatAsTask("3", "chat")).toBe(true);
    expect(shouldTreatDirectChatAsTask("3", "chat")).toBe(true);
    expect(shouldTreatDirectChatAsTask("?", "chat")).toBe(false);
  });

  it("task", () => {
    expect(shouldTreatDirectChatAsTask("[decision reply] 1", "chat")).toBe(false);
    expect(shouldTreatDirectChatAsTask("[ ] 2", "chat")).toBe(false);
  });

  it("", () => {
    const contextual = resolveContextualTaskMessage("", [
      { content: "", messageType: "chat", createdAt: 3000 },
      { content: "?", messageType: "chat", createdAt: 2000 },
      { content: ", !", messageType: "chat", createdAt: 1000 },
    ]);
    expect(contextual).toBe("?");
  });

  it("", () => {
    const contextual = resolveContextualTaskMessage(
      "yes, please proceed",
      [
        { content: "yes, please proceed", messageType: "chat", createdAt: 3000 },
        {
          content: "Can you evaluate the current source-code design and run the task?",
          messageType: "chat",
          createdAt: 2000,
        },
      ],
      [{ content: "I can do that. Should I start right away?", createdAt: 2500 }],
    );
    expect(contextual).toBe("Can you evaluate the current source-code design and run the task?");
  });

  it("", () => {
    const contextual = resolveContextualTaskMessage(
      "yes",
      [
        { content: "yes", messageType: "chat", createdAt: 3000 },
        { content: "?", messageType: "chat", createdAt: 2000 },
      ],
      [{ content: "", createdAt: 2500 }],
    );
    expect(contextual).toBeNull();
  });

  it("", () => {
    const contextual = resolveContextualTaskMessage("", [
      { content: "", messageType: "chat", createdAt: 3000 },
      { content: "", messageType: "chat", createdAt: 2000 },
      { content: "?", messageType: "chat", createdAt: 1000 },
    ]);
    expect(contextual).toBeNull();
  });

  it("", () => {
    expect(isProjectProgressInquiry("?")).toBe(true);
    expect(isProjectProgressInquiry("Can you share the current project task progress?")).toBe(true);
    expect(isProjectProgressInquiry("プロジェクト進捗どこまで？")).toBe(true);
    expect(isProjectProgressInquiry("当前项目任务进度怎么样？")).toBe(true);
    expect(isProjectProgressInquiry("")).toBe(false);
  });

  it("/", () => {
    expect(
      shouldPreserveStructuredFallback(",  ?\n1️⃣  \n2️⃣"),
    ).toBe(true);
    expect(
      shouldPreserveStructuredFallback(
        ".\n1. Doro []\n   : /Users/classys/Projects/claw-empire\n2. Claw-Empire\n   : /Users/classys/Projects/climpire",
      ),
    ).toBe(true);
    expect(shouldPreserveStructuredFallback(".  .")).toBe(false);
  });
});
