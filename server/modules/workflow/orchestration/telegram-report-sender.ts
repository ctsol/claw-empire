import { sendByChannelForReport } from "../../../gateway/client.ts";

/**
 * Sends a report to all enabled Telegram sessions (or dedicated report channel if configured).
 *
 * @param db - SQLite database instance (not used directly; kept for API compatibility)
 * @param teamName - Name of the team sending the report (used as a prefix)
 * @param text - Report text to send
 */
export async function sendTelegramReportToChannel(
  db: unknown,
  teamName: string,
  text: string,
): Promise<void> {
  console.log(`[telegram-report] sendTelegramReportToChannel called, teamName="${teamName}", textLen=${text?.length ?? 0}`);
  try {
    const prefix = teamName ? `📊 [${teamName}]\n` : "";
    const message = `${prefix}${text}`.trim();
    if (!message) {
      console.warn("[telegram-report] message is empty, skipping");
      return;
    }

    console.log(`[telegram-report] calling sendByChannelForReport, messageLen=${message.length}`);
    await sendByChannelForReport("telegram", message);
    console.log("[telegram-report] sendByChannelForReport completed");
  } catch (err) {
    console.warn("[telegram-report] report channel send error:", err);
  }
}
