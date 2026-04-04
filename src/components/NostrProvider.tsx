import React, { useEffect, useMemo, useRef } from 'react';
import { NostrEvent, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppConfig } from './AppProvider';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config, availableRelays } = useAppConfig();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrls = useRef<string[]>(config.relayUrls);
  const available = useRef(availableRelays);

  // Update refs when config changes and reset queries
  useEffect(() => {
    relayUrls.current = config.relayUrls;
    available.current = availableRelays;
    queryClient.resetQueries();
  }, [config.relayUrls, availableRelays, queryClient]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter(filters) {
        // Route queries to all active relays simultaneously
        const relays = relayUrls.current.length > 0 ? relayUrls.current : available.current.map(r => r.url);
        return new Map(relays.map(url => [url, filters]));
      },
      eventRouter(_event: NostrEvent) {
        return available.current.map((info) => info.url);
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
