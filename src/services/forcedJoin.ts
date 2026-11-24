import { Telegraf, Markup } from 'telegraf';
import { storage } from './storage.js';
import { escapeHtml } from '../utils/helpers.js';
import { notifyError } from './errorReporter.js';
import { BotSettings } from '../types.js';

/**
 * Check if user is a member of the forced join channel
 */
export async function checkUserMembership(bot: Telegraf, userId: number): Promise<boolean> {
  const settings = storage.getSettings();

  // If forced join is disabled or no channel is set, allow access
  if (!settings.forcedJoinEnabled || !settings.forcedJoinChannel) {
    return true;
  }

  // Admins always bypass forced join
  if (storage.isAdmin(userId)) {
    return true;
  }

  try {
    const member = await bot.telegram.getChatMember(settings.forcedJoinChannel, userId);
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    return validStatuses.includes(member.status);
  } catch (err) {
    console.error(`Error checking forced join for user ${userId} in ${settings.forcedJoinChannel}:`, err);
    // If bot can't check (e.g. not admin in target channel), don't block users, but notify admin
    await notifyError('بررسی عضویت اجباری (Forced Join Check)', err);
    return true;
  }
}

/**
 * Build forced join prompt text and keyboard
 */
export function getForcedJoinPrompt(settings: BotSettings) {
  const channel = settings.forcedJoinChannel || '';
  let channelUrl = 'https://t.me/';
  if (channel.startsWith('@')) {
    channelUrl += channel.slice(1);
  } else if (!channel.startsWith('-')) {
    channelUrl += channel;
  }

  const title = settings.forcedJoinChannelTitle || channel;

  const text = `
⚠️ <b>عضویت در کانال الزامی است</b>
───────────────────────
کاربر گرامی، جهت استفاده از ربات استعلام نرخ لحظه‌ای طلا و ارز، ابتدا باید در کانال رسمی ما عضو شوید.

📢 <b>کانال:</b> <b>${escapeHtml(title)}</b>
───────────────────────
پس از عضویت در کانال، روی دکمه <b>«🔄 بررسی و تایید عضویت»</b> کلیک کنید:
  `.trim();

  const buttons: any[] = [];
  if (channel.startsWith('@') || !channel.startsWith('-')) {
    buttons.push([Markup.button.url(`📢 ورود به کانال ${title}`, channelUrl)]);
  }

  buttons.push([Markup.button.callback('🔄 بررسی و تایید عضویت', 'check_forced_join_status')]);

  return {
    text,
    keyboard: Markup.inlineKeyboard(buttons),
  };
}
