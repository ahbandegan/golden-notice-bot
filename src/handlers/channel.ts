import { Telegraf, Markup } from 'telegraf';
import { storage } from '../services/storage.js';
import { escapeHtml } from '../utils/helpers.js';

export function registerChannelHandlers(bot: Telegraf) {
  // Listen for bot membership updates (added to channel or group)
  bot.on('my_chat_member', async (ctx) => {
    const chat = ctx.chat;
    const newStatus = ctx.myChatMember.new_chat_member.status;

    // Check if bot was added as administrator or member
    if (newStatus === 'administrator' || (chat.type !== 'channel' && newStatus === 'member')) {
      const settings = storage.getSettings();

      const chatTitle = 'title' in chat ? chat.title : (chat.username ? `@${chat.username}` : String(chat.id));
      const chatTypeFa = chat.type === 'channel' ? 'کانال' : (chat.type === 'supergroup' ? 'سوپرگروه' : 'گروه');

      console.log(`🤖 Bot added to ${chatTypeFa}: ${chatTitle} (${chat.id}) as ${newStatus}`);

      // If admins are set, notify them in PV
      for (const adminId of settings.adminIds) {
        try {
          await bot.telegram.sendMessage(
            adminId,
            `🔔 <b>اطلاعیه افزودن ربات</b>\n\n` +
              `ربات به عنوان ${newStatus === 'administrator' ? 'مدیر (Admin)' : 'عضو'} به ${chatTypeFa} <b>${escapeHtml(chatTitle)}</b> اضافه شد.\n` +
              `شناسه (Chat ID): <code>${chat.id}</code>\n\n` +
              `آیا می‌خواهید این ${chatTypeFa} به عنوان مقصد ارسال لحظه‌ای نرخ‌ها تنظیم شود؟`,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback(
                    `✅ بله، تنظیم ${chatTypeFa} به عنوان مقصد`,
                    `admin_set_chat_auto_${chat.id}`
                  ),
                ],
              ]),
            }
          );
        } catch (err) {
          console.error(`Failed to notify admin ${adminId} of new chat member event:`, err);
        }
      }
    }
  });

  // Action: Confirm setting target chat from notification
  bot.action(/^admin_set_chat_auto_(.+)$/, async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const targetChatId = ctx.match[1];
    let title: string | undefined;

    try {
      const chatInfo = await bot.telegram.getChat(targetChatId);
      if ('title' in chatInfo && chatInfo.title) {
        title = chatInfo.title;
      }
    } catch {}

    storage.setTargetChat(targetChatId, title);
    await ctx.answerCbQuery('✅ مقصد ارسال با موفقیت تنظیم شد!');

    await ctx.editMessageText(
      `✅ مقصد ارسال با موفقیت روی <b>${escapeHtml(title || targetChatId)}</b> (<code>${targetChatId}</code>) تنظیم شد.\n\n` +
        `اکنون می‌توانید از پنل مدیریت، ارسال خودکار را فعال نمایید.`,
      { parse_mode: 'HTML' }
    );
  });
}
