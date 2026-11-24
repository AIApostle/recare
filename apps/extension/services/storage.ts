import { UserPreferences } from '../types';

const PREFERENCES_STORAGE_KEY = 'recare_user_preferences';
const ONBOARDING_COMPLETED_KEY = 'recare_onboarding_completed';

export const DEFAULT_PREFERENCES: UserPreferences = {
  interaction_mode: 'assist',
  inference_mode: 'PREFER_IN_CLOUD',
  speech_rate: 1.0,
  text_size: 'medium',
  voice_enabled: true,
  response_output_mode: 'both',
  voice_gender: 'neutral',
  simplified_language: false,
  reduced_motion: false,
  high_contrast: false,
  auto_approve_low_risk: true,
};

export class StorageService {
  static async getPreferences(): Promise<UserPreferences> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(PREFERENCES_STORAGE_KEY);
        return result[PREFERENCES_STORAGE_KEY] || DEFAULT_PREFERENCES;
      }
      const local = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      return local ? JSON.parse(local) : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  static async savePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const updated = { ...current, ...prefs };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [PREFERENCES_STORAGE_KEY]: updated });
      } else {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Failed to save preferences to storage:', e);
    }
    return updated;
  }

  static async isOnboardingCompleted(): Promise<boolean> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(ONBOARDING_COMPLETED_KEY);
        return Boolean(result[ONBOARDING_COMPLETED_KEY]);
      }
      return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  static async setOnboardingCompleted(completed: boolean = true): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [ONBOARDING_COMPLETED_KEY]: completed });
      } else {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, String(completed));
      }
    } catch (e) {
      console.warn('Failed to save onboarding status:', e);
    }
  }
}
