import { sendMessengerMessage } from "../../../gateway/client.ts";

const MESSENGER_SETTINGS_KEY = "messengerChannels";

/**
 * Sends a report to the configured Telegram report channel (if any).
 * The report channel is a dedicated channel for all team reports — separate from
 * regular chat sessions.
 *
 * @param db - SQLite database instance
 * @param teamName - Name of the team sending the report (used as a prefix)
 * @param text - Report text to send
 */
export async function sendTelegramReportToChannel(
  db: { prepare: (sql: string) => { get: (key: string) => { value?: unknown } | undefined } },
  teamName: string,
  text: string,
): Promise<void> {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(MESSENGER_SETTINGS_KEY) as
      | { value?: unknown }
      | undefined;
    if (!row?.value) return;
    const channels = JSON.parse(String(row.value)) as Record<string, unknown>;
    const telegram = channels?.telegram as Record<string, unknown> | undefined;
    if (!telegram) return;

    const reportChannel = telegram.reportChannel as
      | { token?: string; targetId?: string; enabled?: boolean }
      | undefined;
    if (!reportChannel) return;
    if (reportChannel.enabled === false) return;
    const targetId = String(reportChannel.targetId ?? "").trim();
    if (!targetId) return;

    const prefix = teamName ? `📊 [${teamName}]\n` : "";
    const message = `${prefix}${text}`;

    await sendMessengerMessage({ channel: "telegram", targetId, text: message }).catch((err: unknown) => {
      console.warn(`[telegram-report] failed to send to report channel ${targetId}: ${String(err)}`);
    });
  } catch (err) {
    console.warn("[telegram-report] report channel send error:", err);
  }
}
