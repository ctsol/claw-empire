import { describe, expect, it, vi } from "vitest";
import { createMeetingPromptTools } from "./meeting-prompt-tools.ts";
import type { AgentRow } from "./conversation-types.ts";

function createAgent(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: "agent-1",
    name: "DORO",
    name_ko: "",
    role: "junior",
    personality: null,
    status: "idle",
    department_id: "design",
    current_task_id: null,
    avatar_emoji: "🎨",
    cli_provider: "claude",
    oauth_account_id: null,
    api_provider_id: null,
    api_model: null,
    cli_model: null,
    cli_reasoning_level: null,
    ...overrides,
  };
}

function createTools() {
  return createMeetingPromptTools({
    getDeptName: () => "Design",
    getDeptRoleConstraint: () => "",
    getRoleLabel: () => "Junior",
    getRecentConversationContext: () => "",
    getAgentDisplayName: (agent) => agent.name,
    formatMeetingTranscript: () => "",
    compactTaskDescriptionForMeeting: () => "",
    normalizeMeetingLang: () => "en",
    localeInstruction: () => "Respond in English.",
    resolveLang: () => "en",
  });
}

describe("buildDirectReplyPrompt", () => {
  it("includes character persona block when personality exists", () => {
    const tools = createTools();
    const agent = createAgent({
      personality: "Playful design specialist. Call CEO '' and keep warm expressive tone.",
    });
    const built = tools.buildDirectReplyPrompt(agent, "Can you help me now?", "chat");
    expect(built.prompt).toContain("[Character Persona - Highest Priority]");
    expect(built.prompt).toContain("Playful design specialist");
    expect(built.prompt).toContain("Stay in character consistently");
    expect(built.prompt).toContain("Keep the reply aligned with the Character Persona.");
  });

  it("omits persona block when personality is empty", () => {
    const tools = createTools();
    const agent = createAgent({ personality: null });
    const built = tools.buildDirectReplyPrompt(agent, "Can you help me now?", "chat");
    expect(built.prompt).not.toContain("[Character Persona - Highest Priority]");
    expect(built.prompt).not.toContain("Keep the reply aligned with the Character Persona.");
  });
});

describe("buildMeetingPrompt", () => {
  it("passes workflow pack key into department name lookup", () => {
    const getDeptName = vi.fn(() => "");
    const tools = createMeetingPromptTools({
      getDeptName,
      getDeptRoleConstraint: () => "",
      getRoleLabel: () => "",
      getRecentConversationContext: () => "",
      getAgentDisplayName: (agent) => agent.name_ko,
      formatMeetingTranscript: () => "",
      compactTaskDescriptionForMeeting: () => "",
      normalizeMeetingLang: () => "ko",
      localeInstruction: () => ".",
      resolveLang: () => "ko",
    });
    const prompt = tools.buildMeetingPrompt(createAgent({ department_id: "dev", role: "team_leader" }), {
      meetingType: "planned",
      round: 1,
      taskTitle: "",
      taskDescription: "",
      workflowPackKey: "video_preprod",
      transcript: [],
      turnObjective: "",
      lang: "ko",
    });
    expect(getDeptName).toHaveBeenCalledWith("dev", "video_preprod");
    expect(prompt).toContain("Remotion");
  });
});
