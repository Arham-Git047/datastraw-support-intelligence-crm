import { UserPreferences } from '../types';

const KEY = 'datastraw-support-crm-preferences-v1';
export const DEFAULT_PREFERENCES: UserPreferences = {
  autoAnalyze: true,
  showAIExplanations: true,
  compactMode: false,
  desktopNotifications: false,
};

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(value: UserPreferences) {
  localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new Event('preferences-changed'));
}
