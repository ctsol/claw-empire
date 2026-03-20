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
  try {
    const prefix = teamName ? `📊 [${teamName}]\n` : "";
    const message = `${prefix}${text}`.trim();
    if (!message) return;

    await sendByChannelForReport("telegram", message);
  } catch (err) {
    console.warn("[telegram-report] report channel send error:", err);
  }
}
