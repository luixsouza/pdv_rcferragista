import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Initialize with initialValue first to avoid hydration mismatch or waiting
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Load data from Electron Store (or LocalStorage as fallback)
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.electron) {
          const item = await window.electron.store.get(key);
          if (item !== undefined && item !== null) {
            setStoredValue(item);
          }
        } else {
          // Fallback to localStorage for web dev
          const item = window.localStorage.getItem(key);
          if (item) {
            setStoredValue(JSON.parse(item));
          }
        }
      } catch (error) {
        console.error(`Error reading storage key "${key}":`, error);
      }
    };
    loadData();
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        
        if (window.electron) {
          window.electron.store.set(key, valueToStore);
        } else {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting storage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}
