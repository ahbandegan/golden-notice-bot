import { Telegraf } from 'telegraf';
import { storage } from './storage.js';
import { escapeHtml, getCurrentShamsiDateTime } from '../utils/helpers.js';

let botInstance: Telegraf | null = null;
const errorCooldownMap = new Map<string, number>();
const COOLDOWN_MS = 60 * 1000; // 1 minute per unique error

export function initErrorReporter(bot: Telegraf) {
  botInstance = bot;
}

/**
 * Send formatted error notification to configured error channel or admins
 */
export async function notifyError(location: string, err: unknown) {
  const errMessage = err instanceof Error ? err.message : String(err);
  const errStack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : '';

  console.error(`[ERROR in ${location}]:`, err);

  if (!botInstance) return;

  const settings = storage.getSettings();
  if (!settings.errorNotificationEnabled) return;

  // Check cooldown to prevent flooding
  const cacheKey = `${location}:${errMessage}`;
  const now = Date.now();
  const lastSent = errorCooldownMap.get(cacheKey) || 0;
  if (now - lastSent < COOLDOWN_MS) {
    return;
  }
  errorCooldownMap.set(cacheKey, now);

  const { fullDate, weekday, time } = getCurrentShamsiDateTime();

  const text = `
🚨 <b>گزارش خطای ربات (Bot Error Report)</b>
───────────────────────
🕒 <b>زمان:</b> ${weekday} ${fullDate} - ساعت ${time}
📍 <b>بخش:</b> <code>${escapeHtml(location)}</code>
⚠️ <b>شرح خطا:</b>
<code>${escapeHtml(errMessage)}</code>
${errStack ? `\n🔍 <b>استک:</b>\n<pre>${escapeHtml(errStack)}</pre>` : ''}
───────────────────────
🤖 <i>سیستم مانیتورینگ خودکار ربات نرخ طلا</i>
  `.trim();

  try {
    if (settings.errorChatId) {
      // Send to dedicated error channel / group
      await botInstance.telegram.sendMessage(settings.errorChatId, text, {
        parse_mode: 'HTML',
      });
    } else if (settings.adminIds.length > 0) {
      // Send to all registered admins
      for (const adminId of settings.adminIds) {
        try {
          await botInstance.telegram.sendMessage(adminId, text, {
            parse_mode: 'HTML',
          });
        } catch {
          // ignore individual send errors (e.g. user blocked bot)
        }
      }
    }
  } catch (sendErr) {
    console.error('Failed to dispatch error report message:', sendErr);
  }
}
