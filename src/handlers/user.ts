import { Telegraf } from 'telegraf';
import { storage } from '../services/storage.js';
import { fetchGoldPrices } from '../services/priceApi.js';
import { formatPriceMessage } from '../services/formatter.js';
import { checkUserMembership, getForcedJoinPrompt } from '../services/forcedJoin.js';
import { getUserMainKeyboard, getUserCalculatorKeyboard } from './keyboards.js';
import { setUserState, getUserState, clearUserState } from '../services/adminState.js';
import { formatPersianNumber, toPersianDigits, escapeHtml } from '../utils/helpers.js';

// Cache selected calc item per user
const userCalcItemMap = new Map<number, string>();

export function getUserWelcomeText(userName: string): string {
  return `
👋 سلام <b>${escapeHtml(userName)}</b> عزیز!

به ربات استعلام لحظه‌ای نرخ <b>طلا، انواع سکه و ارز</b> خوش آمدید.
در این سامانه می‌توانید نرخ‌های رسمی و دقیق بازار را به صورت زنده مشاهده کرده یا از ماشین‌حساب هوشمند و مینی‌اپ اختصاصی استفاده نمایید.

لطفاً یکی از گزینه‌های زیر را انتخاب کنید:
  `.trim();
}

export function registerUserHandlers(bot: Telegraf) {
  // Callback: check forced join status
  bot.action('check_forced_join_status', async (ctx) => {
    const userId = ctx.from.id;
    const isMember = await checkUserMembership(bot, userId);

    if (isMember) {
      await ctx.answerCbQuery('✅ عضویت شما تایید شد. خوش آمدید!', { show_alert: true });
      await ctx.editMessageText(getUserWelcomeText(ctx.from.first_name), {
        parse_mode: 'HTML',
        ...getUserMainKeyboard(),
      });
    } else {
      await ctx.answerCbQuery('⚠️ شما هنوز در کانال عضو نشده‌اید! لطفاً ابتدا عضو شوید.', {
        show_alert: true,
      });
    }
  });

  // Action: User get prices directly in PV
  bot.action('user_get_prices', async (ctx) => {
    const userId = ctx.from.id;
    const isMember = await checkUserMembership(bot, userId);
    const settings = storage.getSettings();

    if (!isMember) {
      const prompt = getForcedJoinPrompt(settings);
      return ctx.editMessageText(prompt.text, {
        parse_mode: 'HTML',
        ...prompt.keyboard,
      });
    }

    await ctx.answerCbQuery('⏳ دریافت جدیدترین قیمت‌ها...');
    try {
      const data = await fetchGoldPrices();
      const text = formatPriceMessage(data, {
        enabledItems: settings.enabledItems,
        signature: settings.channelSignature,
        templateStyle: settings.templateStyle,
        customIcons: settings.customIcons,
      });

      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...getUserMainKeyboard(),
      });
    } catch (err) {
      await ctx.reply('❌ در حال حاضر دریافت نرخ‌ها با اختلال موقت مواجه شده است. لطفاً کمی بعد تلاش فرمایید.');
    }
  });

  // Action: Calculator Menu
  bot.action('user_menu_calc', async (ctx) => {
    const userId = ctx.from.id;
    const isMember = await checkUserMembership(bot, userId);
    const settings = storage.getSettings();

    if (!isMember) {
      const prompt = getForcedJoinPrompt(settings);
      return ctx.editMessageText(prompt.text, {
        parse_mode: 'HTML',
        ...prompt.keyboard,
      });
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `
🧮 <b>ماشین‌حساب هوشمند طلا، سکه و ارز</b>
───────────────────────
لطفاً نمادی که قصد محاسبه قیمت آن را دارید انتخاب فرمایید:
      `.trim(),
      {
        parse_mode: 'HTML',
        ...getUserCalculatorKeyboard(),
      }
    );
  });

  // Action: Calculator select item
  const calcItems: Record<string, { label: string; unit: string; prompt: string }> = {
    geram18: { label: 'طلای ۱۸ عیار', unit: 'گرم', prompt: 'وزن طلا را به گرم وارد کنید (مثلاً: <code>4.5</code> یا <code>10</code>):' },
    geram24: { label: 'طلای ۲۴ عیار', unit: 'گرم', prompt: 'وزن طلا را به گرم وارد کنید (مثلاً: <code>3.2</code> یا <code>5</code>):' },
    sekeb: { label: 'سکه امامی', unit: 'عدد', prompt: 'تعداد سکه را وارد کنید (مثلاً: <code>1</code> یا <code>3</code>):' },
    sekeb_old: { label: 'سکه بهار آزادی', unit: 'عدد', prompt: 'تعداد سکه را وارد کنید (مثلاً: <code>2</code>):' },
    nim_sekeh: { label: 'نیم سکه', unit: 'عدد', prompt: 'تعداد نیم‌سکه را وارد کنید (مثلاً: <code>1</code>):' },
    rob_sekkeh: { label: 'ربع سکه', unit: 'عدد', prompt: 'تعداد ربع‌سکه را وارد کنید (مثلاً: <code>2</code>):' },
    price_dollar_rl: { label: 'دلار آمریکا', unit: 'دلار', prompt: 'مقدار دلار مورد نظر را وارد کنید (مثلاً: <code>100</code> یا <code>500</code>):' },
  };

  for (const [key, info] of Object.entries(calcItems)) {
    bot.action(`user_calc_item_${key}`, async (ctx) => {
      const userId = ctx.from.id;
      userCalcItemMap.set(userId, key);
      setUserState(userId, 'USER_CALC_GRAMS');

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `
🧮 <b>محاسبه ارزش ${escapeHtml(info.label)}</b>
───────────────────────
${info.prompt}
        `.trim(),
        {
          parse_mode: 'HTML',
          ...getUserCalculatorKeyboard(),
        }
      );
    });
  }

  // Action: Back to user main menu
  bot.action('user_back_to_main', async (ctx) => {
    clearUserState(ctx.from.id);
    await ctx.answerCbQuery();
    await ctx.editMessageText(getUserWelcomeText(ctx.from.first_name), {
      parse_mode: 'HTML',
      ...getUserMainKeyboard(),
    });
  });

  // Action: About & Help
  bot.action('user_menu_about', async (ctx) => {
    const settings = storage.getSettings();
    await ctx.answerCbQuery();

    const channelInfo = settings.channelSignature
      ? `📢 کانال ما: <b>${escapeHtml(settings.channelSignature)}</b>\n`
      : '';

    const text = `
ℹ️ <b>درباره سامانه اعلام لحظه‌ای طلا و ارز</b>
───────────────────────
این ربات نرخ‌های معتبر و رسمی انواع طلا، سکه‌های بهار آزادی و دلار آزاد را به صورت لحظه‌ای از منابع رسمی بازار واکشی می‌نماید.

${channelInfo}✨ امکانات اختصاصی:
• اطلاع‌رسانی خودکار و دوره‌ای در کانال و گروه
• استعلام فوری و بدون تاخیر قیمت‌ها
• ماشین‌حساب دقیق و بدون کارمزد اضافی
───────────────────────
با آرزوی موفقیت و برکت برای کسب و کار شما 💛
    `.trim();

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...getUserMainKeyboard(),
    });
  });

  // Message Listener for regular user calculator text inputs
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();

    const userId = ctx.from.id;
    const state = getUserState(userId);

    if (state === 'USER_CALC_GRAMS') {
      const itemKey = userCalcItemMap.get(userId) || 'geram18';
      const msg = ctx.message as any;
      const rawText = msg.text ? msg.text.trim().replace(/[۰-۹]/g, (d: string) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) : '';
      const amount = parseFloat(rawText);

      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('⚠️ لطفاً یک عدد معتبر بزرگتر از صفر وارد فرمایید:');
        return;
      }

      clearUserState(userId);

      try {
        const data = await fetchGoldPrices();
        const priceItem = data.data[itemKey];

        if (!priceItem || !priceItem.value) {
          await ctx.reply('⚠️ داده‌ای برای نماد انتخابی یافت نشد.');
          return;
        }

        const total = priceItem.value * amount;
        const totalFormatted = formatPersianNumber(total);
        const unit = priceItem.unit || 'تومان';
        const label = priceItem.label || itemKey;

        const info = calcItems[itemKey];
        const unitName = info ? info.unit : 'واحد';

        const resultText = `
🧮 <b>نتیجه محاسبه قیمت:</b>
───────────────────────
🔹 <b>نماد:</b> ${escapeHtml(label)}
🔹 <b>مقدار / وزن:</b> <b>${toPersianDigits(amount)}</b> ${unitName}
🔹 <b>نرخ واحد فعلی:</b> <code>${formatPersianNumber(priceItem.value)}</code> ${unit}
───────────────────────
💰 <b>مبلغ کل:</b>
<b>${totalFormatted}</b> ${unit}
        `.trim();

        await ctx.reply(resultText, {
          parse_mode: 'HTML',
          ...getUserMainKeyboard(),
        });
        return;
      } catch (err) {
        await ctx.reply('❌ خطا در استعلام قیمت برای محاسبه. لطفاً دوباره امتحان کنید.');
        return;
      }
    }

    return next();
  });
}
