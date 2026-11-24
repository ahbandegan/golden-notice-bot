import { Markup } from 'telegraf';
import { BotSettings, SUPPORTED_ITEMS, TemplateStyle } from '../types.js';
import { toPersianDigits } from '../utils/helpers.js';

export function getMainAdminKeyboard(settings: BotSettings) {
  const autoStatusText = settings.autoSend ? '🟢 ارسال خودکار: روشن' : '🔴 ارسال خودکار: خاموش';
  const targetText = settings.targetChatId
    ? `🎯 مقصد: ${settings.targetChatTitle || settings.targetChatId}`
    : '🎯 تنظیم مقصد ارسال ⚠️';

  let schedSummary = '';
  if (settings.scheduleType === 'interval') {
    schedSummary = `⏰ هر ${toPersianDigits(settings.intervalMinutes)} دقیقه`;
  } else {
    schedSummary = `⏰ روزانه (${toPersianDigits(settings.dailyTimes.length)} نوبت)`;
  }

  const enabledCount = settings.enabledItems.length;
  const totalCount = SUPPORTED_ITEMS.length;

  const errorStatus = settings.errorNotificationEnabled ? '🚨 گزارش خطا: فعال' : '🚨 گزارش خطا: خاموش';
  const forcedStatus = settings.forcedJoinEnabled ? '🔒 عضویت اجباری: فعال' : '🔒 عضویت اجباری: غیرفعال';

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 مشاهده زنده نرخ‌ها', 'admin_view_prices'),
      Markup.button.callback('🚀 ارسال دستی به مقصد', 'admin_manual_send'),
    ],
    [
      Markup.button.callback(targetText, 'admin_menu_target'),
      Markup.button.callback(schedSummary, 'admin_menu_schedule'),
    ],
    [
      Markup.button.callback(autoStatusText, 'admin_toggle_auto'),
    ],
    [
      Markup.button.callback(`📋 فیلتر نمادها (${toPersianDigits(enabledCount)}/${toPersianDigits(totalCount)})`, 'admin_menu_items'),
      Markup.button.callback('🎨 قالب و استیکرها', 'admin_menu_appearance'),
    ],
    [
      Markup.button.callback(`👥 ادمین‌ها (${toPersianDigits(settings.adminIds.length)})`, 'admin_menu_admins'),
      Markup.button.callback('✍️ امضای کانال', 'admin_menu_signature'),
    ],
    [
      Markup.button.callback(errorStatus, 'admin_menu_errors'),
      Markup.button.callback(forcedStatus, 'admin_menu_forced_join'),
    ],
    [
      Markup.button.callback('🔄 بروزرسانی پنل', 'admin_refresh_panel'),
    ],
  ]);
}

export function getAppearanceKeyboard(settings: BotSettings) {
  const styleNames: Record<TemplateStyle, string> = {
    deluxe: '👑 زرین لوکس (کانالی)',
    compact: '⚡️ مینیمال و فشرده',
    classic: '📜 کلاسیک کادربندی',
  };

  const currentStyleLabel = styleNames[settings.templateStyle] || styleNames.deluxe;

  const rows: any[] = [
    [Markup.button.callback(`🔘 قالب انتخابی: ${currentStyleLabel}`, 'admin_switch_template')],
  ];

  // Grid of items to change icon
  let currentRow: any[] = [];
  for (const item of SUPPORTED_ITEMS) {
    const currentIcon = settings.customIcons[item.key] || item.icon;
    const btnText = `${currentIcon} ${item.label.split(' ')[0]}`;
    currentRow.push(Markup.button.callback(btnText, `admin_set_icon_${item.key}`));

    if (currentRow.length === 2) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Header icon customization
  const headerIcon = settings.customIcons['header'] || '🪙';
  rows.push([
    Markup.button.callback(`${headerIcon} تغییر آیکون سربرگ (Header)`, 'admin_set_icon_header'),
  ]);

  rows.push([
    Markup.button.callback('🔄 بازنشانی تمام آیکون‌ها به پیش‌فرض', 'admin_reset_all_icons'),
  ]);

  rows.push([
    Markup.button.callback('🔙 بازگشت به منوی اصلی', 'admin_back_to_main'),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function getAdminsManagementKeyboard(adminIds: number[]) {
  const rows: any[] = [
    [Markup.button.callback('➕ افزودن ادمین جدید', 'admin_add_new_admin')],
  ];

  if (adminIds.length > 1) {
    for (const id of adminIds) {
      rows.push([
        Markup.button.callback(`❌ حذف ادمین: ${toPersianDigits(id)}`, `admin_remove_id_${id}`),
      ]);
    }
  }

  rows.push([
    Markup.button.callback('🔙 بازگشت به منوی اصلی', 'admin_back_to_main'),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function getErrorSettingsKeyboard(settings: BotSettings) {
  const toggleText = settings.errorNotificationEnabled
    ? '🟢 ارسال گزارش خطا: فعال'
    : '🔴 ارسال گزارش خطا: غیرفعال';

  const targetText = settings.errorChatId
    ? `🎯 مقصد خطا: ${settings.errorChatId}`
    : '🎯 تنظیم کانال/گروه اختصاصی خطا (اختیاری)';

  return Markup.inlineKeyboard([
    [Markup.button.callback(toggleText, 'admin_toggle_error_notify')],
    [Markup.button.callback(targetText, 'admin_set_error_chat')],
    [Markup.button.callback('🧪 ارسال تست گزارش خطا', 'admin_test_error_report')],
    [Markup.button.callback('🔙 بازگشت به منوی اصلی', 'admin_back_to_main')],
  ]);
}

export function getForcedJoinKeyboard(settings: BotSettings) {
  const toggleText = settings.forcedJoinEnabled
    ? '🟢 وضعیت عضویت اجباری: فعال'
    : '🔴 وضعیت عضویت اجباری: غیرفعال';

  const channelText = settings.forcedJoinChannel
    ? `📢 کانال تعیین‌شده: ${settings.forcedJoinChannelTitle || settings.forcedJoinChannel}`
    : '📢 تعیین کانال عضویت اجباری';

  return Markup.inlineKeyboard([
    [Markup.button.callback(toggleText, 'admin_toggle_forced_join')],
    [Markup.button.callback(channelText, 'admin_set_forced_channel')],
    [Markup.button.callback('🔙 بازگشت به منوی اصلی', 'admin_back_to_main')],
  ]);
}

export function getTargetChatKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 بازگشت به منوی اصلی', 'admin_back_to_main')],
  ]);
}

export function getScheduleKeyboard(settings: BotSettings) {
  const isInterval = settings.scheduleType === 'interval';
  const modeText = isInterval ? '🔘 حالت کنونی: بازه زمانی ⏱' : '🔘 حالت کنونی: ساعات روزانه 📅';

  const rows: any[] = [
    [Markup.button.callback(modeText, 'admin_switch_sched_mode')],
  ];

  if (isInterval) {
    rows.push([
      Markup.button.callback(
        `${settings.intervalMinutes === 15 ? '🔹 ' : ''}۱۵ دقیقه`,
        'admin_set_interval_15'
      ),
      Markup.button.callback(
        `${settings.intervalMinutes === 30 ? '🔹 ' : ''}۳۰ دقیقه`,
        'admin_set_interval_30'
      ),
    ]);
    rows.push([
      Markup.button.callback(
        `${settings.intervalMinutes === 60 ? '🔹 ' : ''}۱ ساعت`,
        'admin_set_interval_60'
      ),
      Markup.button.callback(
        `${settings.intervalMinutes === 120 ? '🔹 ' : ''}۲ ساعت`,
        'admin_set_interval_120'
      ),
    ]);
    rows.push([
      Markup.button.callback(
        `${settings.intervalMinutes === 240 ? '🔹 ' : ''}۴ ساعت`,
        'admin_set_interval_240'
      ),
      Markup.button.callback(
        `${settings.intervalMinutes === 360 ? '🔹 ' : ''}۶ ساعت`,
        'admin_set_interval_360'
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback('۱۱:۰۰ و ۱۴:۰۰', 'admin_preset_times_2'),
      Markup.button.callback('۱۲:۰۰ و ۱۸:۰۰', 'admin_preset_times_noon_eve'),
    ]);
    rows.push([
      Markup.button.callback('۱۱:۰۰، ۱۴:۳۰ و ۱۸:۰۰', 'admin_preset_times_3'),
      Markup.button.callback('۱۰:۰۰، ۱۳:۰۰، ۱۶:۰۰، ۱۹:۰۰', 'admin_preset_times_4'),
    ]);
    rows.push([
      Markup.button.callback('✏️ تایپ ساعت‌های دلخواه', 'admin_enter_custom_times'),
    ]);
  }

  rows.push([
    Markup.button.callback('🔙 بازگشت به منوی اصلی', 'admin_back_to_main'),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function getItemsSelectorKeyboard(enabledItems: string[]) {
  const rows: any[] = [];
  let currentRow: any[] = [];

  for (const item of SUPPORTED_ITEMS) {
    const isEnabled = enabledItems.includes(item.key);
    const statusIcon = isEnabled ? '✅' : '❌';
    const btn = Markup.button.callback(
      `${statusIcon} ${item.icon} ${item.label}`,
      `admin_toggle_item_${item.key}`
    );

    currentRow.push(btn);
    if (currentRow.length === 2) {
      rows.push(currentRow);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  rows.push([
    Markup.button.callback('✅ انتخاب همه', 'admin_items_enable_all'),
    Markup.button.callback('❌ لغو همه', 'admin_items_disable_all'),
  ]);

  rows.push([
    Markup.button.callback('🔙 بازگشت به منوی اصلی', 'admin_back_to_main'),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function getClaimAdminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👑 ثبت من به عنوان مدیر ربات', 'claim_admin_role')],
  ]);
}

/**
 * Regular User Keyboards
 */
export function getUserMainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 استعلام لحظه‌ای قیمت‌ها', 'user_get_prices')],
    [Markup.button.callback('🧮 ماشین‌حساب طلا و سکه', 'user_menu_calc')],
    [Markup.button.callback('ℹ️ راهنما و درباره ما', 'user_menu_about')],
  ]);
}

export function getUserCalculatorKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🥇 طلای ۱۸ عیار', 'user_calc_item_geram18'),
      Markup.button.callback('✨ طلای ۲۴ عیار', 'user_calc_item_geram24'),
    ],
    [
      Markup.button.callback('🟡 سکه امامی', 'user_calc_item_sekeb'),
      Markup.button.callback('🪙 سکه بهار آزادی', 'user_calc_item_sekeb_old'),
    ],
    [
      Markup.button.callback('🌓 نیم سکه', 'user_calc_item_nim_sekeh'),
      Markup.button.callback('🌘 ربع سکه', 'user_calc_item_rob_sekkeh'),
    ],
    [
      Markup.button.callback('💵 دلار آمریکا', 'user_calc_item_price_dollar_rl'),
    ],
    [
      Markup.button.callback('🔙 بازگشت به منوی کاربر', 'user_back_to_main'),
    ],
  ]);
}
