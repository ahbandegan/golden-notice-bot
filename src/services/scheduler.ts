import { Telegraf } from 'telegraf';
import cron, { ScheduledTask } from 'node-cron';
import { storage } from './storage.js';
import { fetchGoldPrices } from './priceApi.js';
import { formatPriceMessage } from './formatter.js';
import { notifyError } from './errorReporter.js';

export class PriceScheduler {
  private bot: Telegraf;
  private cronJob: ScheduledTask | null = null;
  private isBroadcasting = false;
  private lastDailySentMinute = '';

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  public start() {
    console.log('⏰ Starting Price Scheduler engine...');

    // Run every minute at second 0
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.checkAndBroadcast();
    });
  }

  public stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    console.log('🛑 Price Scheduler stopped.');
  }

  private async checkAndBroadcast() {
    if (this.isBroadcasting) return;

    const settings = storage.getSettings();

    // Check if auto-send is enabled and target chat exists
    if (!settings.autoSend || !settings.targetChatId) {
      return;
    }

    const now = new Date();

    // Get current Tehran time
    const tehranTimeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    let shouldBroadcast = false;

    if (settings.scheduleType === 'daily') {
      // Check if current Tehran time matches any of the dailyTimes
      if (settings.dailyTimes.includes(tehranTimeStr)) {
        if (this.lastDailySentMinute !== tehranTimeStr) {
          shouldBroadcast = true;
          this.lastDailySentMinute = tehranTimeStr;
        }
      }
    } else {
      // Interval mode
      const intervalMs = settings.intervalMinutes * 60 * 1000;
      if (!settings.lastSentAt) {
        shouldBroadcast = true;
      } else {
        const lastSentTime = new Date(settings.lastSentAt).getTime();
        if (now.getTime() - lastSentTime >= intervalMs) {
          shouldBroadcast = true;
        }
      }
    }

    if (shouldBroadcast) {
      await this.executeBroadcast(settings.targetChatId);
    }
  }

  public async executeBroadcast(chatId: string) {
    this.isBroadcasting = true;
    const settings = storage.getSettings();

    try {
      console.log(`📡 Fetching latest rates for auto-broadcast to ${chatId}...`);
      const data = await fetchGoldPrices(true);
      const message = formatPriceMessage(data, {
        enabledItems: settings.enabledItems,
        signature: settings.channelSignature,
        templateStyle: settings.templateStyle,
        customIcons: settings.customIcons,
      });

      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'HTML',
      });

      storage.recordSent();
      console.log(`✅ Broadcast successfully delivered to ${chatId}`);
    } catch (err) {
      console.error(`❌ Failed auto-broadcast to ${chatId}:`, (err as Error).message);
      await notifyError(`ارسال خودکار به ${chatId}`, err);
    } finally {
      this.isBroadcasting = false;
    }
  }
}
