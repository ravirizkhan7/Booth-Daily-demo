import { Settings } from '../../types';
import { mockStore } from '../store';

export const settingsRepository = {
  async getSettings(): Promise<Settings> {
    return mockStore.getSettings();
  },

  async updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    return mockStore.updateSettings(newSettings);
  },
};
