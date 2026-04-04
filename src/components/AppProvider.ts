import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AppConfig {
  /** Selected relay URLs */
  relayUrls: string[];
}

interface RelayInfo {
  /** Relay URL */
  url: string;
  /** Display name for the relay */
  name: string;
}

// Available relay options
export const RELAY_OPTIONS: RelayInfo[] = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

// Default application configuration
const DEFAULT_CONFIG: AppConfig = {
  relayUrls: ['wss://relay.nostr.band', 'wss://relay.damus.io'],
};

interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update any configuration value */
  updateConfig: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  /** Available relay options */
  availableRelays: RelayInfo[];
  /** Check if a relay URL is selected */
  isRelaySelected: (url: string) => boolean;
  /** Toggle a relay URL on/off */
  toggleRelay: (url: string) => void;
  /** Add a custom relay URL if it's not in the options */
  addCustomRelay: (url: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'nostr:app-config';

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [config, setConfig] = useState<AppConfig>(() => {
    // Migrate old single relayUrl to relayUrls array
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.relayUrls && Array.isArray(parsed.relayUrls) && parsed.relayUrls.length > 0) {
          return { ...DEFAULT_CONFIG, ...parsed };
        }
        // Migrate old single relayUrl
        if (parsed.relayUrl) {
          return { ...DEFAULT_CONFIG, relayUrls: [parsed.relayUrl] };
        }
      }
    } catch (error) {
      console.warn('Failed to load app config from localStorage:', error);
    }
    return DEFAULT_CONFIG;
  });

  // Save config to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save app config to localStorage:', error);
    }
  }, [config]);

  // Generic config updater
  const updateConfig = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Check if a relay URL is selected
  const isRelaySelected = (url: string) => {
    // Normalize URLs for comparison
    const normalizedConfigUrls = config.relayUrls.map(u => u.replace(/\/$/, ''));
    const normalizedUrl = url.replace(/\/$/, '');
    return normalizedConfigUrls.includes(normalizedUrl);
  };

  // Toggle a relay URL on/off
  const toggleRelay = (url: string) => {
    const normalizedConfigUrls = config.relayUrls.map(u => u.replace(/\/$/, ''));
    const normalizedUrl = url.replace(/\/$/, '');
    const exists = normalizedConfigUrls.includes(normalizedUrl);

    if (exists) {
      // Don't deselect the last relay
      if (config.relayUrls.length <= 1) return;
      setConfig(prev => ({
        ...prev,
        relayUrls: prev.relayUrls.filter(u => u.replace(/\/$/, '') !== normalizedUrl),
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        relayUrls: [...prev.relayUrls, url],
      }));
    }
  };

  // Add a custom relay URL
  const addCustomRelay = (url: string) => {
    const normalizedConfigUrls = config.relayUrls.map(u => u.replace(/\/$/, ''));
    const normalizedUrl = url.replace(/\/$/, '');
    if (!normalizedConfigUrls.includes(normalizedUrl)) {
      setConfig(prev => ({
        ...prev,
        relayUrls: [...prev.relayUrls, url],
      }));
    }
  };

  const contextValue: AppContextType = {
    config,
    updateConfig,
    availableRelays: RELAY_OPTIONS,
    isRelaySelected,
    toggleRelay,
    addCustomRelay,
  };

  return React.createElement(AppContext.Provider, { value: contextValue }, children);
}

/**
 * Hook to access and update application configuration
 * @returns Application context with config and update methods
 */
export function useAppConfig() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppProvider');
  }
  return context;
}
