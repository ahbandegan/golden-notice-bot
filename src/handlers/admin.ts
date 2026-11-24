import { Telegraf } from 'telegraf';
import { storage } from '../services/storage.js';
import { fetchGoldPrices } from '../services/priceApi.js';
import { formatPriceMessage } from '../services/formatter.js';
import { notifyError } from '../services/errorReporter.js';
import { checkUserMembership, getForcedJoinPrompt } from '../services/forcedJoin.js';
import { getUserWelcomeText } from './user.js';
import {
  getMainAdminKeyboard,
  getTargetChatKeyboard,
  getScheduleKeyboard,
  getItemsSelectorKeyboard,
  getClaimAdminKeyboard,
  getAdminsManagementKeyboard,
  getErrorSettingsKeyboard,
  getForcedJoinKeyboard,
  getUserMainKeyboard,
  getAppearanceKeyboard,
} from './keyboards.js';
import {
  setAdminState,
  getAdminState,
  clearAdminState,
  setEditingIconItem,
  getEditingIconItem,
} from '../services/adminState.js';
import { toPersianDigits, escapeHtml } from '../utils/helpers.js';
import { BotSettings, SUPPORTED_ITEMS, TemplateStyle } from '../types.js';

export function getAdminDashboardText(settings: BotSettings): string {
  const adminsStr = settings.adminIds.length > 0
    ? settings.adminIds.map((id) => `<code>${toPersianDigits(id)}</code>`).join(' ، ')
    : '<i>تنظیم نشده</i>';

  const targetStr = settings.targetChatId
    ? `<code>${settings.targetChatId}</code> ${settings.targetChatTitle ? `(${escapeHtml(settings.targetChatTitle)})` : ''}`
    : '❌ <i>هنوز تنظیم نشده است</i>';

  const autoStr = settings.autoSend
    ? '🟢 <b>فعال</b> (ارسال خودکار روشن است)'
    : '🔴 <b>غیرفعال</b> (ارسال خودکار خاموش است)';

  let schedStr = '';
  if (settings.scheduleType === 'interval') {
    schedStr = `⏱ هر <b>${toPersianDigits(settings.intervalMinutes)}</b> دقیقه`;
  } else {
    schedStr = `📅 روزانه در ساعت‌های: <b>${settings.dailyTimes.map((t) => toPersianDigits(t)).join(' ، ')}</b>`;
  }

  const lastSentStr = settings.lastSentAt
    ? toPersianDigits(new Date(settings.lastSentAt).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran' }))
    : '<i>هنوز ارسالی انجام نشده</i>';

  const errorReportStr = settings.errorNotificationEnabled
    ? `🟢 فعال ${settings.errorChatId ? `(به: <code>${settings.errorChatId}</code>)` : '(به تمام مدیران)'}`
    : '🔴 غیرفعال';

  const forcedStr = settings.forcedJoinEnabled
    ? `🟢 فعال ${settings.forcedJoinChannel ? `(کانال: <code>${escapeHtml(settings.forcedJoinChannel)}</code>)` : ''}`
    : '🔴 غیرفعال';

  const styleNames: Record<string, string> = {
    deluxe: '👑 زرین لوکس (کانالی)',
    compact: '⚡️ مینیمال و فشرده',
    classic: '📜 کلاسیک کادربندی',
  };
  const templateStr = styleNames[settings.templateStyle] || styleNames['deluxe'];

  return `
👑 <b>پنل مدیریت ربات نرخ طلا، سکه و ارز</b>
───────────────────────
👥 <b>شناسه‌های مدیران:</b> ${adminsStr}
📢 <b>مقصد ارسال (کانال/گروه):</b> ${targetStr}
🔄 <b>وضعیت ارسال خودکار:</b> ${autoStr}
⏰ <b>زمان‌بندی:</b> ${schedStr}
🎨 <b>قالب پیام:</b> <b>${templateStr}</b>
📦 <b>نمادهای فعال:</b> <b>${toPersianDigits(settings.enabledItems.length)}</b> از ${toPersianDigits(SUPPORTED_ITEMS.length)} مورد
✍️ <b>امضای پیام:</b> ${settings.channelSignature ? `<code>${escapeHtml(settings.channelSignature)}</code>` : '<i>پیش‌فرض ربات</i>'}
🚨 <b>سیستم گزارش خطا:</b> ${errorReportStr}
🔒 <b>عضویت اجباری:</b> ${forcedStr}
🕒 <b>آخرین ارسال:</b> ${lastSentStr}
───────────────────────
⚙️ لطفاً یکی از گزینه‌های زیر را جهت مدیریت انتخاب فرمایید:
`.trim();
}

export function registerAdminHandlers(bot: Telegraf) {
  // Command: /start
  bot.start(async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    const settings = storage.getSettings();

    // Check if no admins exist at all
    if (settings.adminIds.length === 0) {
      return ctx.reply(
        `👋 سلام <b>${escapeHtml(ctx.from.first_name)}</b> عزیز!\n\n` +
          `🔹 چت آیدی شما: <code>${userId}</code>\n\n` +
          `⚠️ هنوز هیچ مدیری برای این ربات ثبت نشده است.\n` +
          `برای ثبت خود به عنوان مدیر اصلی ربات، روی دکمه زیر کلیک کنید:`,
        {
          parse_mode: 'HTML',
          ...getClaimAdminKeyboard(),
        }
      );
    }

    // Check if user is one of the admins
    if (storage.isAdmin(userId)) {
      clearAdminState(userId);
      return ctx.reply(getAdminDashboardText(settings), {
        parse_mode: 'HTML',
        ...getMainAdminKeyboard(settings),
      });
    }

    // Regular User
    const isMember = await checkUserMembership(bot, userId);
    if (!isMember) {
      const prompt = getForcedJoinPrompt(settings);
      return ctx.reply(prompt.text, {
        parse_mode: 'HTML',
        ...prompt.keyboard,
      });
    }

    return ctx.reply(getUserWelcomeText(ctx.from.first_name), {
      parse_mode: 'HTML',
      ...getUserMainKeyboard(),
    });
  });

  // Command: /admin
  bot.command('admin', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const userId = ctx.from.id;
    if (!storage.isAdmin(userId)) {
      return ctx.reply('⛔️ شما دسترسی به پنل مدیریت ندارید.', { parse_mode: 'HTML' });
    }

    clearAdminState(userId);
    const settings = storage.getSettings();
    return ctx.reply(getAdminDashboardText(settings), {
      parse_mode: 'HTML',
      ...getMainAdminKeyboard(settings),
    });
  });

  // Action: Claim admin role (when empty)
  bot.action('claim_admin_role', async (ctx) => {
    const userId = ctx.from.id;
    const settings = storage.getSettings();

    if (settings.adminIds.length > 0 && !storage.isAdmin(userId)) {
      return ctx.answerCbQuery('⛔️ مدیر ربات قبلاً ثبت شده است!');
    }

    storage.addAdmin(userId);
    await ctx.answerCbQuery('✅ شما با موفقیت به عنوان مدیر ربات ثبت شدید!');

    const updated = storage.getSettings();
    await ctx.editMessageText(getAdminDashboardText(updated), {
      parse_mode: 'HTML',
      ...getMainAdminKeyboard(updated),
    });
  });

  // Action: Refresh panel
  bot.action('admin_refresh_panel', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    const settings = storage.getSettings();
    try {
      await ctx.editMessageText(getAdminDashboardText(settings), {
        parse_mode: 'HTML',
        ...getMainAdminKeyboard(settings),
      });
      await ctx.answerCbQuery('🔄 پنل مدیریت بروزرسانی شد.');
    } catch {
      await ctx.answerCbQuery('تغییری وجود نداشت.');
    }
  });

  // Action: Back to main menu
  bot.action('admin_back_to_main', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    clearAdminState(ctx.from.id);
    const settings = storage.getSettings();
    try {
      await ctx.editMessageText(getAdminDashboardText(settings), {
        parse_mode: 'HTML',
        ...getMainAdminKeyboard(settings),
      });
    } catch {}
    await ctx.answerCbQuery();
  });

  // Action: View live prices (Preview in PV)
  bot.action('admin_view_prices', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    await ctx.answerCbQuery('⏳ در حال دریافت آخرین نرخ‌ها از سرور...');
    try {
      const data = await fetchGoldPrices(true);
      const settings = storage.getSettings();
      const text = formatPriceMessage(data, {
        enabledItems: settings.enabledItems,
        signature: settings.channelSignature,
        templateStyle: settings.templateStyle,
        customIcons: settings.customIcons,
      });

      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...getTargetChatKeyboard(),
      });
    } catch (err) {
      await ctx.reply(`❌ خطا در دریافت نرخ‌ها از API:\n<code>${escapeHtml((err as Error).message)}</code>`, {
        parse_mode: 'HTML',
      });
    }
  });

  // Action: Manual Send to target channel/group
  bot.action('admin_manual_send', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    if (!settings.targetChatId) {
      await ctx.answerCbQuery('⚠️ مقصد ارسال هنوز تنظیم نشده است!', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('🚀 در حال ارسال به کانال/گروه...');
    try {
      const data = await fetchGoldPrices(true);
      const text = formatPriceMessage(data, {
        enabledItems: settings.enabledItems,
        signature: settings.channelSignature,
        templateStyle: settings.templateStyle,
        customIcons: settings.customIcons,
      });

      await bot.telegram.sendMessage(settings.targetChatId, text, { parse_mode: 'HTML' });
      storage.recordSent();

      await ctx.reply(`✅ نرخ‌های لحظه‌ای با موفقیت به مقصد <b>${escapeHtml(settings.targetChatTitle || settings.targetChatId)}</b> ارسال شد.`, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      await ctx.reply(
        `❌ خطا در ارسال به کانال/گروه:\n<code>${escapeHtml((err as Error).message)}</code>\n\n` +
          `💡 <i>نکته: اطمینان حاصل کنید ربات در کانال یا گروه مقصد عضو بوده و دارای دسترسی «ارسال پیام» (Admin) است.</i>`,
        { parse_mode: 'HTML' }
      );
      await notifyError('ارسال دستی به کانال/گروه', err);
    }
  });

  // Action: Toggle auto send
  bot.action('admin_toggle_auto', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    if (!settings.targetChatId && !settings.autoSend) {
      await ctx.answerCbQuery('⚠️ ابتدا باید مقصد ارسال (کانال یا گروه) را تنظیم کنید!', {
        show_alert: true,
      });
      return;
    }

    const newState = storage.toggleAutoSend();
    await ctx.answerCbQuery(newState ? '🟢 ارسال خودکار فعال شد.' : '🔴 ارسال خودکار غیرفعال شد.');

    const updated = storage.getSettings();
    await ctx.editMessageText(getAdminDashboardText(updated), {
      parse_mode: 'HTML',
      ...getMainAdminKeyboard(updated),
    });
  });

  // -------------------------------------------------------------
  // Admins Management Menu
  // -------------------------------------------------------------
  bot.action('admin_menu_admins', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    const listStr = settings.adminIds
      .map((id, index) => `${toPersianDigits(index + 1)}. <code>${toPersianDigits(id)}</code> ${id === ctx.from.id ? '(شما)' : ''}`)
      .join('\n');

    const text = `
👥 <b>مدیریت مدیران ربات (Admins Management)</b>
───────────────────────
لیست مدیران مجاز به استفاده از پنل:
${listStr}

💡 برای افزودن مدیر جدید، روی دکمه زیر کلیک کنید.
    `.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getAdminsManagementKeyboard(settings.adminIds),
    });
    await ctx.answerCbQuery();
  });

  bot.action('admin_add_new_admin', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    setAdminState(ctx.from.id, 'WAITING_ADD_ADMIN');
    await ctx.editMessageText(
      `
➕ <b>افزودن مدیر جدید</b>
───────────────────────
لطفاً شناسه عددی (Telegram Chat ID) فرد مورد نظر را ارسال فرمایید (مثلاً: <code>123456789</code>):
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getTargetChatKeyboard(),
      }
    );
    await ctx.answerCbQuery();
  });

  // Remove admin action
  bot.action(/^admin_remove_id_(\d+)$/, async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const targetId = Number(ctx.match[1]);
    const settings = storage.getSettings();

    if (settings.adminIds.length <= 1) {
      return ctx.answerCbQuery('⚠️ حداقل یک مدیر باید در سیستم باقی بماند!', { show_alert: true });
    }

    storage.removeAdmin(targetId);
    await ctx.answerCbQuery(`✅ مدیر با شناسه ${targetId} با موفقیت حذف شد.`);

    const updated = storage.getSettings();
    const listStr = updated.adminIds
      .map((id, index) => `${toPersianDigits(index + 1)}. <code>${toPersianDigits(id)}</code> ${id === ctx.from.id ? '(شما)' : ''}`)
      .join('\n');

    await ctx.editMessageText(
      `
👥 <b>مدیریت مدیران ربات (Admins Management)</b>
───────────────────────
لیست مدیران مجاز به استفاده از پنل:
${listStr}
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getAdminsManagementKeyboard(updated.adminIds),
      }
    );
  });

  // -------------------------------------------------------------
  // Error Notification Menu
  // -------------------------------------------------------------
  bot.action('admin_menu_errors', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    const destStr = settings.errorChatId
      ? `کانال/گروه اختصاصی: <code>${settings.errorChatId}</code>`
      : 'پیوی تمام ادمین‌های ربات';

    const text = `
🚨 <b>تنظیمات سیستم گزارش خطا (Error Reporting)</b>
───────────────────────
📊 <b>وضعیت ارسال:</b> ${settings.errorNotificationEnabled ? '🟢 فعال' : '🔴 غیرفعال'}
🎯 <b>مقصد دریافت خطاها:</b> ${destStr}

هنگامی که خطایی در دریافت اطلاعات از API یا ارسال خودکار به کانال رخ دهد، ربات جزئیات خطا را فورا مخابره می‌کند.
    `.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getErrorSettingsKeyboard(settings),
    });
    await ctx.answerCbQuery();
  });

  bot.action('admin_toggle_error_notify', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const newState = storage.toggleErrorNotification();
    await ctx.answerCbQuery(newState ? '🟢 ارسال گزارش خطا فعال شد.' : '🔴 ارسال گزارش خطا غیرفعال شد.');

    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getErrorSettingsKeyboard(updated).reply_markup);
  });

  bot.action('admin_set_error_chat', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    setAdminState(ctx.from.id, 'WAITING_ERROR_CHAT');
    await ctx.editMessageText(
      `
🎯 <b>تنظیم کانال یا گروه دریافت خطاهای ربات</b>
───────────────────────
آیدی عددی کانال/گروه لاگ خطا (مانند: <code>-100123456789</code>) یا یوزرنیم آن را بفرستید.

<i>همچنین اگر می‌خواهید خطاها فقط در پیوی ادمین‌ها دریافت شوند، کلمه <b>حذف</b> را ارسال فرمایید.</i>
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getTargetChatKeyboard(),
      }
    );
    await ctx.answerCbQuery();
  });

  bot.action('admin_test_error_report', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    await ctx.answerCbQuery('🧪 در حال مخابره خطای آزمایشی...');
    await notifyError('تست پنل ادمین', 'این یک پیام تستی برای اعتبارسنجی سیستم اطلاع‌رسانی خطای ربات است.');
    await ctx.reply('✅ گزارش خطای آزمایشی به مقصد تنظیم‌شده مخابره گردید.');
  });

  // -------------------------------------------------------------
  // Forced Join Menu
  // -------------------------------------------------------------
  bot.action('admin_menu_forced_join', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    const chanStr = settings.forcedJoinChannel
      ? `<code>${settings.forcedJoinChannel}</code> ${settings.forcedJoinChannelTitle ? `(${escapeHtml(settings.forcedJoinChannelTitle)})` : ''}`
      : '<i>تنظیم نشده</i>';

    const text = `
🔒 <b>تنظیمات عضویت اجباری (Forced Membership)</b>
───────────────────────
📊 <b>وضعیت:</b> ${settings.forcedJoinEnabled ? '🟢 فعال' : '🔴 غیرفعال'}
📢 <b>کانال هدف:</b> ${chanStr}

در صورت فعال بودن، کاربران عادی قبل از استعلام قیمت، استفاده از مینی‌اپ یا ماشین‌حساب باید در این کانال عضو شوند.
    `.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getForcedJoinKeyboard(settings),
    });
    await ctx.answerCbQuery();
  });

  bot.action('admin_toggle_forced_join', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    if (!settings.forcedJoinChannel && !settings.forcedJoinEnabled) {
      return ctx.answerCbQuery('⚠️ ابتدا باید کانال عضویت اجباری را تعیین کنید!', { show_alert: true });
    }

    const newState = storage.toggleForcedJoin();
    await ctx.answerCbQuery(newState ? '🟢 عضویت اجباری فعال شد.' : '🔴 عضویت اجباری غیرفعال شد.');

    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getForcedJoinKeyboard(updated).reply_markup);
  });

  bot.action('admin_set_forced_channel', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    setAdminState(ctx.from.id, 'WAITING_FORCED_CHANNEL');
    await ctx.editMessageText(
      `
📢 <b>تعیین کانال عضویت اجباری</b>
───────────────────────
یوزرنیم کانال (مثلاً: <code>@MyChannel</code>) یا آیدی عددی کانال (<code>-100...</code>) را بفرستید:

💡 <i>توجه: ربات باید در کانال عضو باشد تا بتواند عضویت کاربران را بررسی کند.</i>
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getTargetChatKeyboard(),
      }
    );
    await ctx.answerCbQuery();
  });

  // -------------------------------------------------------------
  // Appearance & Custom / Premium Icons Menu
  // -------------------------------------------------------------
  bot.action('admin_menu_appearance', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    const styleDescriptions: Record<string, string> = {
      deluxe: '👑 <b>زرین لوکس:</b> دسته‌بندی شکیل با بخش‌های مجزای طلا، سکه و ارز و جداکننده‌های مدرن کانالی',
      compact: '⚡️ <b>مینیمال و فشرده:</b> نمایش تک‌خطی فشرده و سریع بدون فاصله اضافی',
      classic: '📜 <b>کلاسیک کادربندی:</b> سبک کادربندی سنتی و تفکیکی',
    };

    const text = `
🎨 <b>تنظیمات قالب ظاهری و استیکرهای پرمیوم</b>
───────────────────────
📊 <b>قالب فعلی:</b>
${styleDescriptions[settings.templateStyle] || styleDescriptions['deluxe']}
───────────────────────
روی هر نماد کلیک کنید تا بتوانید ایموجی معمولی یا <b>استیکر متحرک پرمیوم</b> دلخواه خود را برای آن تنظیم کنید.
    `.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getAppearanceKeyboard(settings),
    });
    await ctx.answerCbQuery();
  });

  bot.action('admin_switch_template', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    const cycle: TemplateStyle[] = ['deluxe', 'compact', 'classic'];
    const nextIndex = (cycle.indexOf(settings.templateStyle) + 1) % cycle.length;
    const nextStyle = cycle[nextIndex];

    storage.setTemplateStyle(nextStyle);
    await ctx.answerCbQuery('✅ استایل قالب تغییر یافت.');

    const updated = storage.getSettings();
    const styleDescriptions: Record<string, string> = {
      deluxe: '👑 <b>زرین لوکس:</b> دسته‌بندی شکیل با بخش‌های مجزای طلا، سکه و ارز و جداکننده‌های مدرن کانالی',
      compact: '⚡️ <b>مینیمال و فشرده:</b> نمایش تک‌خطی فشرده و سریع بدون فاصله اضافی',
      classic: '📜 <b>کلاسیک کادربندی:</b> سبک کادربندی سنتی و تفکیکی',
    };

    await ctx.editMessageText(
      `
🎨 <b>تنظیمات قالب ظاهری و استیکرهای پرمیوم</b>
───────────────────────
📊 <b>قالب جدید:</b>
${styleDescriptions[updated.templateStyle]}
───────────────────────
روی هر نماد کلیک کنید تا آیکون یا استیکر پرمیوم دلخواه برای آن تنظیم کنید:
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getAppearanceKeyboard(updated),
      }
    );
  });

  bot.action(/^admin_set_icon_(.+)$/, async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const itemKey = ctx.match[1];
    setAdminState(ctx.from.id, 'WAITING_ITEM_ICON');
    setEditingIconItem(ctx.from.id, itemKey);

    const label = itemKey === 'header'
      ? 'سربرگ (Header)'
      : (SUPPORTED_ITEMS.find((i) => i.key === itemKey)?.label || itemKey);

    const text = `
🎨 <b>تعیین آیکون / استیکر پرمیوم برای: ${escapeHtml(label)}</b>
───────────────────────
لطفاً ایموجی مورد نظر خود را در همین چت ارسال فرمایید.

✨ <b>پشتیبانی کامل از تلگرام پرمیوم (Telegram Premium):</b>
اگر اکانت شما تلگرام پرمیوم دارد، کافی است <b>استیکر متحرک یا کاستوم ایموجی</b> دلخواه خود را مستقیماً از کیبورد تلگرام ارسال کنید تا ربات تگ اختصاصی آن را ذخیره کند!
همچنین می‌توانید تگ دستی بفرستید:
<code>&lt;tg-emoji emoji-id="5368324170671202286"&gt;🪙&lt;/tg-emoji&gt;</code>
───────────────────────
برای انصراف روی دکمه بازگشت کلیک کنید:
    `.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getTargetChatKeyboard(),
    });
    await ctx.answerCbQuery();
  });

  bot.action('admin_reset_all_icons', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    storage.resetCustomIcons();
    await ctx.answerCbQuery('✅ تمام آیکون‌ها به حالت پیش‌فرض بازگشتند.');

    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getAppearanceKeyboard(updated).reply_markup);
  });

  // -------------------------------------------------------------
  // Target Chat Menu
  // -------------------------------------------------------------
  bot.action('admin_menu_target', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    setAdminState(ctx.from.id, 'WAITING_TARGET_CHAT');
    const settings = storage.getSettings();

    const targetDesc = settings.targetChatId
      ? `🎯 مقصد فعلی: <code>${settings.targetChatId}</code> ${settings.targetChatTitle ? `(${escapeHtml(settings.targetChatTitle)})` : ''}`
      : '❌ مقصدی تنظیم نشده است.';

    const text = `
🎯 <b>تنظیم کانال یا گروه مقصد ارسال</b>
───────────────────────
${targetDesc}

<b>روش تنظیم:</b>
1️⃣ ربات را در کانال یا گروه موردنظر عضو کنید و به آن دسترسی <b>ارسال پیام (Admin)</b> بدهید.
2️⃣ یکی از موارد زیر را همین الان در چت بفرستید:
   • <b>آیدی عددی کانال/گروه</b> (مثل: <code>-1001234567890</code>)
   • <b>یوزرنیم کانال</b> (مثل: <code>@MyGoldChannel</code>)
   • یا یک پیام از کانال را به همین چت <b>فوروارد (Forward)</b> کنید!
───────────────────────
برای لغو، روی دکمه بازگشت کلیک کنید.
`.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getTargetChatKeyboard(),
    });
    await ctx.answerCbQuery();
  });

  // Schedule menu
  bot.action('admin_menu_schedule', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    let schedDesc = '';
    if (settings.scheduleType === 'interval') {
      schedDesc = `⏱ حالت فعلی: ارسال دوره‌ای هر <b>${toPersianDigits(settings.intervalMinutes)} دقیقه</b>`;
    } else {
      schedDesc = `📅 حالت فعلی: ارسال روزانه در ساعت‌های: <b>${settings.dailyTimes.map((t) => toPersianDigits(t)).join(' ، ')}</b>`;
    }

    const text = `
⏰ <b>تنظیمات زمان‌بندی ارسال خودکار</b>
───────────────────────
${schedDesc}

می‌توانید حالت زمان‌بندی را بین «بازه زمانی دوره‌ای» یا «ساعت‌های مشخص در طول روز» تغییر دهید:
`.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getScheduleKeyboard(settings),
    });
    await ctx.answerCbQuery();
  });

  // Switch schedule mode
  bot.action('admin_switch_sched_mode', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    const newMode = settings.scheduleType === 'interval' ? 'daily' : 'interval';
    storage.setScheduleType(newMode);

    await ctx.answerCbQuery(`حالت به ${newMode === 'interval' ? 'بازه زمانی' : 'ساعات روزانه'} تغییر یافت.`);

    const updated = storage.getSettings();
    await ctx.editMessageText(
      `
⏰ <b>تنظیمات زمان‌بندی ارسال خودکار</b>
───────────────────────
حالت جدید: <b>${newMode === 'interval' ? '⏱ بازه زمانی دوره‌ای' : '📅 ساعات مشخص روزانه'}</b>

زمان موردنظر خود را از گزینه‌های زیر انتخاب کنید:
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getScheduleKeyboard(updated),
      }
    );
  });

  // Interval selections
  const intervalMap: Record<string, number> = {
    admin_set_interval_15: 15,
    admin_set_interval_30: 30,
    admin_set_interval_60: 60,
    admin_set_interval_120: 120,
    admin_set_interval_240: 240,
    admin_set_interval_360: 360,
  };

  for (const [actionName, minutes] of Object.entries(intervalMap)) {
    bot.action(actionName, async (ctx) => {
      if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
      storage.setIntervalMinutes(minutes);
      await ctx.answerCbQuery(`✅ بازه زمانی روی هر ${toPersianDigits(minutes)} دقیقه تنظیم شد.`);

      const updated = storage.getSettings();
      await ctx.editMessageReplyMarkup(getScheduleKeyboard(updated).reply_markup);
    });
  }

  // Daily presets
  bot.action('admin_preset_times_2', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    storage.setDailyTimes(['11:00', '14:00']);
    await ctx.answerCbQuery('✅ ساعات روزانه: ۱۱:۰۰ و ۱۴:۰۰ تنظیم شد.');
    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getScheduleKeyboard(updated).reply_markup);
  });

  bot.action('admin_preset_times_noon_eve', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    storage.setDailyTimes(['12:00', '18:00']);
    await ctx.answerCbQuery('✅ ساعات روزانه: ۱۲:۰۰ و ۱۸:۰۰ تنظیم شد.');
    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getScheduleKeyboard(updated).reply_markup);
  });

  bot.action('admin_preset_times_3', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    storage.setDailyTimes(['11:00', '14:30', '18:00']);
    await ctx.answerCbQuery('✅ ساعات روزانه: ۱۱:۰۰، ۱۴:۳۰ و ۱۸:۰۰ تنظیم شد.');
    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getScheduleKeyboard(updated).reply_markup);
  });

  bot.action('admin_preset_times_4', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    storage.setDailyTimes(['10:00', '13:00', '16:00', '19:00']);
    await ctx.answerCbQuery('✅ ساعات روزانه: ۱۰:۰۰، ۱۳:۰۰، ۱۶:۰۰، ۱۹:۰۰ تنظیم شد.');
    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getScheduleKeyboard(updated).reply_markup);
  });

  bot.action('admin_enter_custom_times', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    setAdminState(ctx.from.id, 'WAITING_CUSTOM_TIME');

    await ctx.editMessageText(
      `
✏️ <b>تنظیم ساعت‌های دلخواه روزانه</b>
───────────────────────
ساعت‌های مدنظر خود را به صورت ۲۴ ساعته و با کاما یا فاصله بفرستید.

<b>مثال:</b>
<code>10:30, 14:00, 17:45, 21:00</code>
───────────────────────
برای انصراف دکمه زیر را بزنید:
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getTargetChatKeyboard(),
      }
    );
    await ctx.answerCbQuery();
  });

  // Items menu
  bot.action('admin_menu_items', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    const settings = storage.getSettings();
    const text = `
📋 <b>انتخاب و فیلتر نمادهای قیمتی</b>
───────────────────────
روی هر نماد کلیک کنید تا وضعیت نمایش آن (✅ فعال / ❌ غیرفعال) تغییر کند:
`.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getItemsSelectorKeyboard(settings.enabledItems),
    });
    await ctx.answerCbQuery();
  });

  for (const item of SUPPORTED_ITEMS) {
    bot.action(`admin_toggle_item_${item.key}`, async (ctx) => {
      if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

      const isNowEnabled = storage.toggleItem(item.key);
      await ctx.answerCbQuery(`${item.label}: ${isNowEnabled ? '✅ فعال شد' : '❌ حذف شد'}`);

      const updated = storage.getSettings();
      await ctx.editMessageReplyMarkup(getItemsSelectorKeyboard(updated.enabledItems).reply_markup);
    });
  }

  bot.action('admin_items_enable_all', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    storage.updateSettings({ enabledItems: SUPPORTED_ITEMS.map((i) => i.key) });
    await ctx.answerCbQuery('✅ تمامی نمادها فعال شدند.');
    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getItemsSelectorKeyboard(updated.enabledItems).reply_markup);
  });

  bot.action('admin_items_disable_all', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');
    storage.updateSettings({ enabledItems: [] });
    await ctx.answerCbQuery('❌ تمامی نمادها غیرفعال شدند.');
    const updated = storage.getSettings();
    await ctx.editMessageReplyMarkup(getItemsSelectorKeyboard(updated.enabledItems).reply_markup);
  });

  // Signature menu
  bot.action('admin_menu_signature', async (ctx) => {
    if (!storage.isAdmin(ctx.from.id)) return ctx.answerCbQuery('⛔️ عدم دسترسی');

    setAdminState(ctx.from.id, 'WAITING_SIGNATURE');
    const settings = storage.getSettings();

    const currentSig = settings.channelSignature
      ? `امضای فعلی: <code>${escapeHtml(settings.channelSignature)}</code>`
      : 'امضای فعلی: <i>تنظیم نشده (متن پیش‌فرض ربات)</i>';

    const text = `
✍️ <b>تنظیم امضا یا آیدی کانال در انتهای پیام</b>
───────────────────────
${currentSig}

متن یا آیدی دلخواه خود را ارسال کنید (مثلاً: <code>@MyGoldChannel</code> یا <code>کانال زرین طلا | @Zarin</code>).
<i>همچنین اگر می‌خواهید امضا حذف شود، کلمه <b>حذف</b> را بفرستید.</i>
───────────────────────
برای بازگشت روی دکمه زیر کلیک کنید:
`.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getTargetChatKeyboard(),
    });
    await ctx.answerCbQuery();
  });

  // Text message listener for admin state inputs
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();

    const userId = ctx.from.id;
    if (!storage.isAdmin(userId)) return next();

    const state = getAdminState(userId);
    if (!state) return next();

    const msg = ctx.message as any;
    const text = msg.text ? msg.text.trim() : '';

    // 1. Handling Add Admin
    if (state === 'WAITING_ADD_ADMIN') {
      const newAdminId = Number(text);
      if (isNaN(newAdminId) || newAdminId <= 0) {
        await ctx.reply('⚠️ شناسه عددی نامعتبر است. لطفاً فقط عدد چت‌آیدی را ارسال کنید:');
        return;
      }

      storage.addAdmin(newAdminId);
      clearAdminState(userId);

      await ctx.reply(
        `✅ مدیر جدید با شناسه <code>${newAdminId}</code> با موفقیت اضافه شد.`,
        {
          parse_mode: 'HTML',
          ...getTargetChatKeyboard(),
        }
      );
      return;
    }

    // 2. Handling Target Chat
    if (state === 'WAITING_TARGET_CHAT') {
      let targetId: string | null = null;
      let targetTitle: string | null = null;

      if (msg.forward_from_chat) {
        targetId = String(msg.forward_from_chat.id);
        targetTitle = msg.forward_from_chat.title || msg.forward_from_chat.username || null;
      } else if (text) {
        targetId = text;
      }

      if (targetId) {
        try {
          const chatInfo = await bot.telegram.getChat(targetId);
          if (chatInfo) {
            targetId = String(chatInfo.id);
            if ('title' in chatInfo && chatInfo.title) {
              targetTitle = chatInfo.title;
            } else if ('username' in chatInfo && chatInfo.username) {
              targetTitle = `@${chatInfo.username}`;
            }
          }
        } catch {}

        storage.setTargetChat(targetId, targetTitle || undefined);
        clearAdminState(userId);

        await ctx.reply(
          `✅ مقصد ارسال با موفقیت تنظیم شد:\n` +
            `📢 <b>${escapeHtml(targetTitle || targetId)}</b> (<code>${targetId}</code>)\n\n` +
            `💡 لطفاً مطمئن شوید ربات در این کانال یا گروه ادمین بوده و دسترسی ارسال پیام دارد.`,
          {
            parse_mode: 'HTML',
            ...getTargetChatKeyboard(),
          }
        );
        return;
      }
    }

    // 3. Handling Error Chat
    if (state === 'WAITING_ERROR_CHAT') {
      if (text.toLowerCase() === 'none' || text === 'حذف' || text === 'پاک کردن') {
        storage.setErrorChat(null);
        clearAdminState(userId);
        await ctx.reply('✅ کانال اختصاصی خطا حذف شد و گزارش خطاها به پیوی تمام ادمین‌ها ارسال خواهد شد.', {
          ...getTargetChatKeyboard(),
        });
        return;
      }

      let errorChatId = text;
      try {
        const chatInfo = await bot.telegram.getChat(errorChatId);
        if (chatInfo) {
          errorChatId = String(chatInfo.id);
        }
      } catch {}

      storage.setErrorChat(errorChatId);
      clearAdminState(userId);

      await ctx.reply(
        `✅ مقصد دریافت گزارش خطاها تنظیم شد:\n<code>${errorChatId}</code>`,
        {
          parse_mode: 'HTML',
          ...getTargetChatKeyboard(),
        }
      );
      return;
    }

    // 4. Handling Forced Join Channel
    if (state === 'WAITING_FORCED_CHANNEL') {
      if (text.toLowerCase() === 'none' || text === 'حذف' || text === 'پاک کردن') {
        storage.setForcedJoinChannel(null);
        storage.updateSettings({ forcedJoinEnabled: false });
        clearAdminState(userId);
        await ctx.reply('✅ کانال عضویت اجباری حذف و وضعیت آن غیرفعال شد.', {
          ...getTargetChatKeyboard(),
        });
        return;
      }

      let channelId = text;
      let channelTitle = text;
      try {
        const chatInfo = await bot.telegram.getChat(channelId);
        if (chatInfo) {
          if ('title' in chatInfo && chatInfo.title) {
            channelTitle = chatInfo.title;
          }
        }
      } catch {}

      storage.setForcedJoinChannel(channelId, channelTitle);
      clearAdminState(userId);

      await ctx.reply(
        `✅ کانال عضویت اجباری با موفقیت ثبت شد:\n<b>${escapeHtml(channelTitle)}</b> (<code>${channelId}</code>)`,
        {
          parse_mode: 'HTML',
          ...getTargetChatKeyboard(),
        }
      );
      return;
    }

    // 5. Handling Signature
    if (state === 'WAITING_SIGNATURE') {
      if (text.toLowerCase() === 'none' || text === 'حذف' || text === 'پاک کردن') {
        storage.setSignature('');
        clearAdminState(userId);
        await ctx.reply('✅ امضای انتهای پیام حذف شد و به حالت پیش‌فرض بازگشت.', {
          ...getTargetChatKeyboard(),
        });
        return;
      }

      storage.setSignature(text);
      clearAdminState(userId);
      await ctx.reply(
        `✅ امضای انتهای پیام ذخیره شد:\n<code>${escapeHtml(text)}</code>`,
        {
          parse_mode: 'HTML',
          ...getTargetChatKeyboard(),
        }
      );
      return;
    }

    // 6. Handling Custom Item Icon & Telegram Premium Emojis
    if (state === 'WAITING_ITEM_ICON') {
      const itemKey = getEditingIconItem(userId);
      if (!itemKey) {
        clearAdminState(userId);
        return;
      }

      let selectedIcon = '';
      const entities = msg.entities || [];
      const customEmojiEntity = entities.find((e: any) => e.type === 'custom_emoji');

      if (customEmojiEntity && customEmojiEntity.custom_emoji_id) {
        // Captured Telegram Premium custom emoji
        const rawChar = msg.text.slice(customEmojiEntity.offset, customEmojiEntity.offset + customEmojiEntity.length);
        selectedIcon = `<tg-emoji emoji-id="${customEmojiEntity.custom_emoji_id}">${rawChar || '✨'}</tg-emoji>`;
      } else if (text) {
        selectedIcon = text;
      }

      if (selectedIcon) {
        storage.setCustomIcon(itemKey, selectedIcon);
        clearAdminState(userId);

        await ctx.reply(
          `✅ آیکون/استیکر با موفقیت ذخیره شد:\n` +
            `نمایش آیکون: ${selectedIcon}\n\n` +
            `جهت پیش‌نمایش در پیام، روی دکمه «📊 مشاهده زنده نرخ‌ها» کلیک فرمایید.`,
          {
            parse_mode: 'HTML',
            ...getTargetChatKeyboard(),
          }
        );
        return;
      }
    }

    // 7. Handling Custom Times
    if (state === 'WAITING_CUSTOM_TIME') {
      const timeMatches = text.match(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/g);

      if (!timeMatches || timeMatches.length === 0) {
        await ctx.reply('⚠️ فرمت ساعت‌ها نامعتبر است. لطفاً به صورت <code>11:00, 14:30</code> وارد فرمایید:');
        return;
      }

      const normalizedTimes = timeMatches.map((t: string) => {
        const [h, m] = t.split(':');
        return `${h.padStart(2, '0')}:${m}`;
      });

      const uniqueTimes: string[] = Array.from<string>(new Set(normalizedTimes)).sort();

      storage.setDailyTimes(uniqueTimes);
      storage.setScheduleType('daily');
      clearAdminState(userId);

      await ctx.reply(
        `✅ ساعت‌های ارسال روزانه با موفقیت ثبت شدند:\n` +
          `⏰ <b>${uniqueTimes.map((t) => toPersianDigits(t)).join(' ، ')}</b>`,
        {
          parse_mode: 'HTML',
          ...getTargetChatKeyboard(),
        }
      );
      return;
    }

    return next();
  });
}
