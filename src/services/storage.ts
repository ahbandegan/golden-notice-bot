import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { BotSettings, SUPPORTED_ITEMS, TemplateStyle } from '../types.js';

const initialAdmins: number[] = [];
if (CONFIG.ADMIN_ID) {
  initialAdmins.push(CONFIG.ADMIN_ID);
}

const DEFAULT_SETTINGS: BotSettings = {
  adminIds: initialAdmins,
  targetChatId: CONFIG.TARGET_CHAT_ID,
  targetChatTitle: null,
  autoSend: false,
  scheduleType: 'interval',
  intervalMinutes: 60,
  dailyTimes: ['11:00', '14:30', '18:00'],
  enabledItems: SUPPORTED_ITEMS.map((item) => item.key),
  channelSignature: '',
  lastSentAt: null,
  errorChatId: CONFIG.ERROR_CHAT_ID,
  errorNotificationEnabled: true,
  forcedJoinEnabled: false,
  forcedJoinChannel: CONFIG.FORCED_JOIN_CHANNEL,
  forcedJoinChannelTitle: null,
  templateStyle: 'deluxe',
  customIcons: {},
};

class StorageService {
  private filePath: string;
  private settings: BotSettings;

  constructor() {
    this.filePath = CONFIG.DATA_FILE_PATH;
    this.ensureDirectoryExists();
    this.settings = this.load();
  }

  private ensureDirectoryExists() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): BotSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);

        let adminIds: number[] = Array.isArray(parsed.adminIds) ? parsed.adminIds : [];
        if (parsed.adminId && !adminIds.includes(Number(parsed.adminId))) {
          adminIds.push(Number(parsed.adminId));
        }
        if (CONFIG.ADMIN_ID && !adminIds.includes(CONFIG.ADMIN_ID)) {
          adminIds.push(CONFIG.ADMIN_ID);
        }

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          adminIds,
          enabledItems: Array.isArray(parsed.enabledItems) && parsed.enabledItems.length > 0
            ? parsed.enabledItems
            : DEFAULT_SETTINGS.enabledItems,
          targetChatId: parsed.targetChatId || CONFIG.TARGET_CHAT_ID,
          errorChatId: parsed.errorChatId || CONFIG.ERROR_CHAT_ID,
          forcedJoinChannel: parsed.forcedJoinChannel || CONFIG.FORCED_JOIN_CHANNEL,
          templateStyle: parsed.templateStyle || 'deluxe',
          customIcons: parsed.customIcons || {},
        };
      }
    } catch (err) {
      console.error('⚠️ Error loading settings from disk, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save() {
    try {
      this.ensureDirectoryExists();
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ Failed to save settings to disk:', err);
    }
  }

  public getSettings(): BotSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<BotSettings>): BotSettings {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    this.save();
    return this.getSettings();
  }

  public isAdmin(userId: number | undefined): boolean {
    if (!userId) return false;
    const numId = Number(userId);
    return this.settings.adminIds.includes(numId);
  }

  public addAdmin(userId: number): boolean {
    const numId = Number(userId);
    if (!this.settings.adminIds.includes(numId)) {
      const updated = [...this.settings.adminIds, numId];
      this.updateSettings({ adminIds: updated });
      return true;
    }
    return false;
  }

  public removeAdmin(userId: number): boolean {
    const numId = Number(userId);
    if (this.settings.adminIds.includes(numId)) {
      const updated = this.settings.adminIds.filter((id) => id !== numId);
      this.updateSettings({ adminIds: updated });
      return true;
    }
    return false;
  }

  public toggleItem(itemKey: string): boolean {
    let current = [...this.settings.enabledItems];
    if (current.includes(itemKey)) {
      current = current.filter((k) => k !== itemKey);
    } else {
      current.push(itemKey);
    }
    this.updateSettings({ enabledItems: current });
    return current.includes(itemKey);
  }

  public toggleAutoSend(): boolean {
    const newState = !this.settings.autoSend;
    this.updateSettings({ autoSend: newState });
    return newState;
  }

  public toggleErrorNotification(): boolean {
    const newState = !this.settings.errorNotificationEnabled;
    this.updateSettings({ errorNotificationEnabled: newState });
    return newState;
  }

  public toggleForcedJoin(): boolean {
    const newState = !this.settings.forcedJoinEnabled;
    this.updateSettings({ forcedJoinEnabled: newState });
    return newState;
  }

  public setTargetChat(chatId: string, title?: string): void {
    this.updateSettings({
      targetChatId: chatId,
      targetChatTitle: title || null,
    });
  }

  public setErrorChat(chatId: string | null): void {
    this.updateSettings({ errorChatId: chatId });
  }

  public setForcedJoinChannel(channel: string | null, title?: string): void {
    this.updateSettings({
      forcedJoinChannel: channel,
      forcedJoinChannelTitle: title || null,
    });
  }

  public setScheduleType(type: 'interval' | 'daily'): void {
    this.updateSettings({ scheduleType: type });
  }

  public setIntervalMinutes(minutes: number): void {
    this.updateSettings({ intervalMinutes: minutes });
  }

  public setDailyTimes(times: string[]): void {
    this.updateSettings({ dailyTimes: times });
  }

  public setSignature(sig: string): void {
    this.updateSettings({ channelSignature: sig });
  }

  public setTemplateStyle(style: TemplateStyle): void {
    this.updateSettings({ templateStyle: style });
  }

  public setCustomIcon(itemKey: string, icon: string): void {
    const icons = { ...this.settings.customIcons, [itemKey]: icon };
    this.updateSettings({ customIcons: icons });
  }

  public resetCustomIcons(): void {
    this.updateSettings({ customIcons: {} });
  }

  public recordSent(): void {
    this.updateSettings({ lastSentAt: new Date().toISOString() });
  }
}

export const storage = new StorageService();
