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

    const prefix = teamName ? `📊 [${teamName}]\n` : "";
    const message = `${prefix}${text}`;

    const reportChannel = telegram.reportChannel as
      | { token?: string; targetId?: string; enabled?: boolean }
      | undefined;
    const rcTargetId = String(reportChannel?.targetId ?? "").trim();

    // Use dedicated report channel if configured and not explicitly disabled
    if (rcTargetId && reportChannel?.enabled !== false) {
      await sendMessengerMessage({ channel: "telegram", targetId: rcTargetId, text: message }).catch((err: unknown) => {
        console.warn(`[telegram-report] failed to send to report channel ${rcTargetId}: ${String(err)}`);
      });
      return;
    }

    // Fallback: send to all enabled Telegram sessions
    const sessions = (telegram.sessions as Array<{ targetId?: string; enabled?: boolean }> | undefined) ?? [];
    for (const session of sessions) {
      if (session.enabled === false) continue;
      const sessionTargetId = String(session.targetId ?? "").trim();
      if (!sessionTargetId) continue;
      await sendMessengerMessage({ channel: "telegram", targetId: sessionTargetId, text: message }).catch(
        (err: unknown) => {
          console.warn(`[telegram-report] failed to send to session ${sessionTargetId}: ${String(err)}`);
        },
      );
    }
  } catch (err) {
    console.warn("[telegram-report] report channel send error:", err);
  }
}
