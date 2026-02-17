import { defaultUiPreferences, UiPreferences } from '../theme/theme';

const STORAGE_KEY = 'thunderhead.ui_prefs';

export function loadUiPreferences(): UiPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultUiPreferences, ...JSON.parse(raw) } : defaultUiPreferences;
  } catch {
    return defaultUiPreferences;
  }
}

export function saveUiPreferences(prefs: UiPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function applyUiPreferences(root: HTMLElement, prefs: UiPreferences): void {
  root.classList.toggle('high-contrast', prefs.highContrast);
  root.classList.toggle('crt', prefs.crtEffectsEnabled);
}
