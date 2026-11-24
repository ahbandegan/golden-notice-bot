import { Telegraf } from 'telegraf';
import { CONFIG } from './config.js';
import { getProxyAgent } from './utils/telegramAgent.js';
import { registerAdminHandlers } from './handlers/admin.js';
import { registerChannelHandlers } from './handlers/channel.js';
import { registerUserHandlers } from './handlers/user.js';
import { PriceScheduler } from './services/scheduler.js';
import { initErrorReporter, notifyError } from './services/errorReporter.js';
import { storage } from './services/storage.js';

async function bootstrap() {
  console.log('============================================');
  console.log('🚀 Starting Golden Notice Telegram Bot...');
  console.log('============================================');

  if (!CONFIG.BOT_TOKEN) {
    console.error('❌ FATAL: BOT_TOKEN is missing! Please set BOT_TOKEN in .env file.');
    process.exit(1);
  }

  const agent = getProxyAgent();
  if (agent) {
    console.log(`🌐 Proxy configured: ${CONFIG.PROXY_URL}`);
  } else {
    console.log('🌐 Direct connection (No proxy)');
  }

  // Initialize Telegraf bot
  const bot = new Telegraf(CONFIG.BOT_TOKEN, {
    telegram: {
      agent,
    },
  });

  // Initialize Error Reporter
  initErrorReporter(bot);

  // Global Error Handler
  bot.catch(async (err, ctx) => {
    console.error(`❌ Bot error encountered for update ${ctx.update.update_id}:`, err);
    await notifyError(`پردازش آپدیت تلگرام (#${ctx.update.update_id})`, err);
  });

  // Register Handlers
  registerAdminHandlers(bot);
  registerUserHandlers(bot);
  registerChannelHandlers(bot);

  // Initialize Scheduler
  const scheduler = new PriceScheduler(bot);
  scheduler.start();

  // Print configuration state
  const currentSettings = storage.getSettings();
  console.log(`👥 Admins: ${currentSettings.adminIds.join(', ') || 'None'}`);
  console.log(`🎯 Target Chat: ${currentSettings.targetChatId || 'Not configured yet'}`);
  console.log(`🔄 Auto-Broadcast: ${currentSettings.autoSend ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🚨 Error Notification: ${currentSettings.errorNotificationEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔒 Forced Join: ${currentSettings.forcedJoinEnabled ? 'ENABLED' : 'DISABLED'}`);

  // Launch Bot
  try {
    const botInfo = await bot.telegram.getMe();
    console.log(`✅ Bot successfully connected as @${botInfo.username} (${botInfo.id})`);

    await bot.launch();
    console.log('🤖 Bot is now actively listening for updates...');
  } catch (err) {
    console.error('❌ Failed to launch bot:', err);
    await notifyError('راه‌اندازی اولیه ربات (Launch)', err);
    process.exit(1);
  }

  // Graceful Shutdown
  const stopBot = (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Stopping bot gracefully...`);
    scheduler.stop();
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => stopBot('SIGINT'));
  process.once('SIGTERM', () => stopBot('SIGTERM'));
}

bootstrap().catch(async (err) => {
  console.error('❌ Unhandled bootstrap error:', err);
  process.exit(1);
});
