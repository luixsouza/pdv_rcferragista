import { StoreSettings, defaultSettings } from '@/types/settings';

export function getStoreSettings(): StoreSettings {
  try {
    const w = window as any;
    if (w.electron?.store) {
      const stored = w.electron.store.get('store_settings');
      if (stored) {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        return { ...defaultSettings, ...parsed };
      }
    } else {
      const stored = localStorage.getItem('store_settings');
      if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {}
  return defaultSettings;
}
