import { Settings } from '../types';
import { settingsRepository } from '../mock/repositories/settingsRepository';

export const settingsService = {
  async getSettings(): Promise<Settings> {
    return settingsRepository.getSettings();
  },

  async updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    return settingsRepository.updateSettings(newSettings);
  },
};
