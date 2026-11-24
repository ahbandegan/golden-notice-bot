export interface PriceItem {
  value: number;
  formatted: string;
  unit: string;
  label: string;
  change: number;
  changeFormatted: string;
  stale?: boolean;
  suspicious?: boolean;
  error?: boolean;
  updatedAt?: string;
  cachedAt?: string;
}

export interface GfwApiResponse {
  success: boolean;
  updatedAt: string;
  cachedAt: string;
  ttlSeconds: number;
  staleCount: number;
  errorCount: number;
  demoMode: boolean;
  data: Record<string, PriceItem>;
}

export type ScheduleType = 'interval' | 'daily';
export type TemplateStyle = 'deluxe' | 'compact' | 'classic';

export interface BotSettings {
  adminIds: number[];
  targetChatId: string | null;
  targetChatTitle: string | null;
  autoSend: boolean;
  scheduleType: ScheduleType;
  intervalMinutes: number;
  dailyTimes: string[];
  enabledItems: string[];
  channelSignature: string;
  lastSentAt: string | null;
  // Error reporting settings
  errorChatId: string | null;
  errorNotificationEnabled: boolean;
  // Forced Join settings
  forcedJoinEnabled: boolean;
  forcedJoinChannel: string | null;
  forcedJoinChannelTitle: string | null;
  // Appearance & Custom / Premium Emojis
  templateStyle: TemplateStyle;
  customIcons: Record<string, string>;
}

export interface ItemDefinition {
  key: string;
  label: string;
  category: 'currency' | 'gold' | 'coin';
  icon: string;
}

export const SUPPORTED_ITEMS: ItemDefinition[] = [
  { key: 'price_dollar_rl', label: 'دلار آمریکا (آزاد)', category: 'currency', icon: '💵' },
  { key: 'geram18', label: 'طلای ۱۸ عیار', category: 'gold', icon: '🥇' },
  { key: 'geram24', label: 'طلای ۲۴ عیار', category: 'gold', icon: '✨' },
  { key: 'mesghal', label: 'مثقال طلا', category: 'gold', icon: '⚖️' },
  { key: 'sekeb', label: 'سکه امامی (طرح جدید)', category: 'coin', icon: '🟡' },
  { key: 'sekeb_old', label: 'سکه بهار آزادی (طرح قدیم)', category: 'coin', icon: '🪙' },
  { key: 'nim_sekeh', label: 'نیم سکه', category: 'coin', icon: '🌓' },
  { key: 'rob_sekkeh', label: 'ربع سکه', category: 'coin', icon: '🌘' },
  { key: 'gerami', label: 'سکه گرمی', category: 'coin', icon: '🔹' },
  { key: 'gold_global', label: 'طلای جهانی (انس $)', category: 'gold', icon: '🌍' },
  { key: 'onz', label: 'اونس طلا (تومان)', category: 'gold', icon: '📊' },
];
