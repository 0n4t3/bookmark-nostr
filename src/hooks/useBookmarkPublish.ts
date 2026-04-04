import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface BookmarkData {
  url: string;
  title?: string;
  description: string;
  tags?: string[];
}

export function useBookmarkPublish() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BookmarkData) => {
      // Convert URL to d tag format (remove protocol and clean up)
      let dTag = data.url.replace(/^https?:\/\//, '');
      
      // Remove query string and hash unless explicitly needed
      const urlObj = new URL(data.url);
      dTag = urlObj.hostname + urlObj.pathname + urlObj.search + urlObj.hash;
      
      // Remove trailing slash
      dTag = dTag.replace(/\/$/, '');

      const tags: string[][] = [
        ['d', dTag],
      ];

      // Add optional tags
      if (data.title) {
        tags.push(['title', data.title]);
      }

      // Add published_at timestamp
      tags.push(['published_at', Math.floor(Date.now() / 1000).toString()]);

      // Add topic tags
      if (data.tags && data.tags.length > 0) {
        data.tags.forEach(tag => {
          if (tag.trim()) {
            tags.push(['t', tag.trim().toLowerCase()]);
          }
        });
      }

      const event = await publishEvent({
        kind: 39701,
        content: data.description,
        tags,
      });

      return event;
    },
    onSuccess: () => {
      // Invalidate bookmarks queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['bookmark'] });
    },
  });
}

export function useBookmarkDelete() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookmarkId: string) => {
      // Publish a deletion event (kind 5) referencing the bookmark
      const event = await publishEvent({
        kind: 5,
        content: '',
        tags: [
          ['e', bookmarkId],
        ],
      });

      return event;
    },
    onSuccess: () => {
      // Invalidate bookmarks queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['bookmark'] });
    },
  });
}