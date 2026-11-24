import { GfwApiResponse, SUPPORTED_ITEMS, ItemDefinition, TemplateStyle } from '../types.js';
import {
  formatPersianNumber,
  getCurrentShamsiDateTime,
  toPersianDigits,
  escapeHtml,
} from '../utils/helpers.js';

export interface FormatOptions {
  enabledItems?: string[];
  signature?: string;
  headerTitle?: string;
  templateStyle?: TemplateStyle;
  customIcons?: Record<string, string>;
}

/**
 * Render icon or preserve <tg-emoji> tag safely
 */
function sanitizeIcon(icon: string): string {
  if (!icon) return '▫️';
  // If it's a Telegram Premium custom emoji tag, allow it
  if (icon.startsWith('<tg-emoji') && icon.endsWith('</tg-emoji>')) {
    return icon;
  }
  return escapeHtml(icon);
}

/**
 * Format change percentage with indicator
 */
function formatChange(changeNum: number): string {
  const absChange = toPersianDigits(Math.abs(changeNum).toFixed(1));
  if (changeNum > 0) {
    return `🟢 ${absChange}٪+`;
  } else if (changeNum < 0) {
    return `🔴 ${absChange}٪-`;
  }
  return `▫️ ۰.۰٪`;
}

/**
 * Format GfwApiResponse into a polished Telegram HTML message
 */
export function formatPriceMessage(
  response: GfwApiResponse,
  options: FormatOptions = {}
): string {
  const { fullDate, weekday, time } = getCurrentShamsiDateTime();
  const enabledItems = options.enabledItems || SUPPORTED_ITEMS.map((item) => item.key);
  const signature = options.signature ? options.signature.trim() : '';
  const style = options.templateStyle || 'deluxe';
  const customIcons = options.customIcons || {};

  const headerIcon = sanitizeIcon(customIcons['header'] || '🪙');
  const bulletIcon = sanitizeIcon(customIcons['bullet'] || '▫️');

  // Filter items that are enabled and exist in response data
  const availableItems: { def: ItemDefinition; data: any; icon: string }[] = [];

  for (const def of SUPPORTED_ITEMS) {
    if (enabledItems.includes(def.key) && response.data[def.key]) {
      const itemIcon = sanitizeIcon(customIcons[def.key] || def.icon);
      availableItems.push({
        def,
        data: response.data[def.key],
        icon: itemIcon,
      });
    }
  }

  if (availableItems.length === 0) {
    return '⚠️ هیچ نمادی برای نمایش انتخاب نشده است.';
  }

  // -------------------------------------------------------------
  // STYLE 1: DELUXE (Channel Standard - Luxurious Categorized)
  // -------------------------------------------------------------
  if (style === 'deluxe') {
    const lines: string[] = [];

    // Header
    lines.push(`${headerIcon} <b>نرخ لحظه‌ای طلا، سکه و ارز</b>`);
    lines.push(`📅 ${weekday} ${fullDate}  ▫️  ⏰ ساعت ${time}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━');

    const goldItems = availableItems.filter((i) => i.def.category === 'gold');
    const coinItems = availableItems.filter((i) => i.def.category === 'coin');
    const currItems = availableItems.filter((i) => i.def.category === 'currency');

    // 1. Currency
    if (currItems.length > 0) {
      lines.push('');
      lines.push(`💵 <b>بازار آزاد ارز:</b>`);
      for (const item of currItems) {
        const price = formatPersianNumber(item.data.value);
        const change = formatChange(item.data.change || 0);
        lines.push(`${item.icon} ${escapeHtml(item.def.label)}: <b>${price}</b> ${item.data.unit || 'تومان'} (${change})`);
      }
    }

    // 2. Gold
    if (goldItems.length > 0) {
      lines.push('');
      lines.push(`👑 <b>بازار طلا و مظنه:</b>`);
      for (const item of goldItems) {
        const price = formatPersianNumber(item.data.value);
        const change = formatChange(item.data.change || 0);
        lines.push(`${item.icon} ${escapeHtml(item.def.label)}: <b>${price}</b> ${item.data.unit || 'تومان'} (${change})`);
      }
    }

    // 3. Coins
    if (coinItems.length > 0) {
      lines.push('');
      lines.push(`🟡 <b>بازار مسکوکات:</b>`);
      for (const item of coinItems) {
        const price = formatPersianNumber(item.data.value);
        const change = formatChange(item.data.change || 0);
        lines.push(`${item.icon} ${escapeHtml(item.def.label)}: <b>${price}</b> ${item.data.unit || 'تومان'} (${change})`);
      }
    }

    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━');

    if (signature) {
      lines.push(`📢 <b>${escapeHtml(signature)}</b>`);
    } else {
      lines.push('⏱ <i>بروزرسانی شده با نرخ‌های معتبر بازار</i>');
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------
  // STYLE 2: COMPACT (Ultra-clean single list)
  // -------------------------------------------------------------
  if (style === 'compact') {
    const lines: string[] = [];

    lines.push(`${headerIcon} <b>نرخ زنده طلا و ارز</b> | ⏰ ${time}`);
    lines.push('───────────────────────');

    for (const item of availableItems) {
      const price = formatPersianNumber(item.data.value);
      const unitShort = item.data.unit === 'تومان' ? 'ت' : (item.data.unit || '');
      const change = formatChange(item.data.change || 0);
      lines.push(`${item.icon} ${escapeHtml(item.def.label)}: <b>${price}</b> ${unitShort} (${change})`);
    }

    lines.push('───────────────────────');
    if (signature) {
      lines.push(`📢 ${escapeHtml(signature)}`);
    }

    return lines.join('\n');
  }

  // -------------------------------------------------------------
  // STYLE 3: CLASSIC (Boxed Elegance)
  // -------------------------------------------------------------
  const lines: string[] = [];
  lines.push(`╔═════════════════════╗`);
  lines.push(`   ${headerIcon} <b>اطلاع‌رسانی نرخ‌های بازار</b>`);
  lines.push(`   📅 ${fullDate} - ${time}`);
  lines.push(`╚═════════════════════╝`);
  lines.push('');

  for (const item of availableItems) {
    const price = formatPersianNumber(item.data.value);
    const change = formatChange(item.data.change || 0);
    lines.push(`${item.icon} <b>${escapeHtml(item.def.label)}</b>`);
    lines.push(`   ↳ <b>${price}</b> ${item.data.unit || 'تومان'}  [${change}]`);
  }

  lines.push('');
  lines.push('───────────────────────');
  if (signature) {
    lines.push(`📢 <b>${escapeHtml(signature)}</b>`);
  }

  return lines.join('\n');
}
