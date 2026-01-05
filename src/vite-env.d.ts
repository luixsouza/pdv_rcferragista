/// <reference types="vite/client" />

interface Window {
  electron?: {
    store: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
      delete: (key: string) => Promise<void>;
    };
    openDataFolder: () => Promise<void>;
  };
}
