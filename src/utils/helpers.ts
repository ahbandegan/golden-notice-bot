/**
 * Convert Latin numerals to Persian numerals
 */
export function toPersianDigits(input: string | number): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (char) => farsiDigits[Number(char)] ?? char);
}

/**
 * Format numbers with comma grouping and Persian digits
 */
export function formatPersianNumber(value: number): string {
  if (isNaN(value)) return '۰';
  // Check if it has decimal places
  const isDecimal = value % 1 !== 0;
  const parts = value.toLocaleString('en-US', {
    maximumFractionDigits: isDecimal ? 2 : 0,
    minimumFractionDigits: 0,
  }).split('.');

  const formattedWhole = toPersianDigits(parts[0]);
  if (parts.length > 1 && parts[1]) {
    return `${formattedWhole}.${toPersianDigits(parts[1])}`;
  }
  return formattedWhole;
}

/**
 * Get current Shamsi (Jalali) date and time
 */
export function getCurrentShamsiDateTime(): {
  fullDate: string;
  weekday: string;
  time: string;
} {
  const now = new Date();

  // Jalali Date
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Tehran',
    calendar: 'persian',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  const weekdayOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Tehran',
    calendar: 'persian',
    weekday: 'long',
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const fullDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', dateOptions).format(now);
  const weekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', weekdayOptions).format(now);
  const time = new Intl.DateTimeFormat('fa-IR-u-ca-persian', timeOptions).format(now);

  return {
    fullDate,
    weekday,
    time,
  };
}

/**
 * Return trend emoji and sign for percentage change
 */
export function getTrendInfo(change: number): {
  emoji: string;
  indicator: string;
  sign: string;
} {
  if (change > 0) {
    return {
      emoji: '🟢',
      indicator: '🔺',
      sign: '+',
    };
  } else if (change < 0) {
    return {
      emoji: '🔴',
      indicator: '🔻',
      sign: '',
    };
  } else {
    return {
      emoji: '⚪️',
      indicator: '▫️',
      sign: '',
    };
  }
}

/**
 * Escape HTML special characters for Telegram HTML mode
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
