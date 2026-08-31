import { MockStoreState } from '../types';

export const DEMO_STORAGE_KEY = 'boothdaily_demo_store';

const isLocalStorageAvailable = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      window.localStorage !== null
    );
  } catch {
    return false;
  }
};

/**
 * Load persisted state snapshot from localStorage.
 * Returns null if not found, unavailable, or corrupted.
 */
export function loadPersistedSnapshot(): MockStoreState | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.users) &&
      Array.isArray(parsed.categories) &&
      Array.isArray(parsed.products) &&
      Array.isArray(parsed.stocks) &&
      Array.isArray(parsed.recipes) &&
      Array.isArray(parsed.orders) &&
      Array.isArray(parsed.purchases) &&
      Array.isArray(parsed.discountRules) &&
      parsed.settings
    ) {
      return parsed as MockStoreState;
    }

    return null;
  } catch (err) {
    console.warn('[MockStorage] Failed to parse persisted demo store snapshot:', err);
    return null;
  }
}

/**
 * Persist the entire mock store state snapshot into localStorage.
 */
export function savePersistedSnapshot(state: MockStoreState): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[MockStorage] Failed to save demo store snapshot to localStorage:', err);
  }
}

/**
 * Clear the persisted demo store snapshot from localStorage.
 */
export function clearPersistedSnapshot(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch (err) {
    console.error('[MockStorage] Failed to clear demo store snapshot from localStorage:', err);
  }
}
