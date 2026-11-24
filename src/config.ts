import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  GFW_API_KEY: process.env.GFW_API_KEY || '6850969968:uQODiyGTc3VtwvD9@GFwAPIBOT',
  ADMIN_ID: process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null,
  TARGET_CHAT_ID: process.env.TARGET_CHAT_ID || null,
  ERROR_CHAT_ID: process.env.ERROR_CHAT_ID || null,
  FORCED_JOIN_CHANNEL: process.env.FORCED_JOIN_CHANNEL || null,
  PROXY_URL: process.env.PROXY_URL || null,
  DATA_FILE_PATH: path.resolve(process.cwd(), 'data', 'settings.json'),
  API_BASE_URL: 'https://api.gfwdev.ir/currency/prices',
};

if (!CONFIG.BOT_TOKEN) {
  console.warn('⚠️ WARNING: BOT_TOKEN is not set in environment or .env!');
}
