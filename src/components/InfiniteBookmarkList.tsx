import { useState, useEffect, useCallback } from 'react';
import { useInfiniteBookmarks, type Bookmark } from '@/hooks/useBookmarks';
import { useBookmarkSearch } from '@/hooks/useBookmarkSearch';
import { useFollows } from '@/hooks/useFollows';
import { useBookmarkDelete } from '@/hooks/useBookmarkPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Search, Users, Globe, Loader2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { CommentsSection } from '@/components/CommentsSection';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';
import type { NostrMetadata } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

/** Small HN-style avatar for bookmark authors */
function AuthorAvatar({ pubkey, className = '' }: { pubkey: string; className?: string }) {
  const author = useAuthor(pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;
  const name = metadata?.name || genUserName(pubkey);
  const initial = name.charAt(0).toUpperCase();

  if (metadata?.picture) {
    return (
      <img
        src={metadata.picture}
        alt={name}
        className={cn("rounded-full object-cover flex-shrink-0", className)}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0", className)}
    >
      {initial}
    </div>
  );
}

interface InfiniteBookmarkListProps {
  pubkey?: string;
  showUserFilter?: boolean;
  initialSearchTerm?: string;
  title?: string;
}

export function InfiniteBookmarkList({ pubkey, showUserFilter = false, initialSearchTerm = '', title }: InfiniteBookmarkListProps) {
  const { user } = useCurrentUser();
  const [searchInput, setSearchInput] = useState(initialSearchTerm);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [showFollowsOnly, setShowFollowsOnly] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSearchInput(initialSearchTerm);
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const { data: follows = [] } = useFollows(user?.pubkey);
  const authors = showFollowsOnly && follows.length > 0 ? follows : undefined;
  const isSearching = searchTerm.trim().length > 0;

  const infiniteQuery = useInfiniteBookmarks({
    pubkey,
    authors,
    pageSize: 20
  });

  const searchQuery = useBookmarkSearch({
    query: searchTerm,
    authors: pubkey ? [pubkey] : authors,
    tags: undefined,
    limit: 100,
  });

  const { mutate: deleteBookmark } = useBookmarkDelete();

  const data = isSearching ? undefined : infiniteQuery.data;
  const fetchNextPage = infiniteQuery.fetchNextPage;
  const hasNextPage = isSearching ? false : infiniteQuery.hasNextPage;
  const isFetchingNextPage = isSearching ? false : infiniteQuery.isFetchingNextPage;
  const isLoading = isSearching ? searchQuery.isLoading : infiniteQuery.isLoading;
  const error = isSearching ? searchQuery.error : infiniteQuery.error;

  const allBookmarks = isSearching
    ? (searchQuery.data || [])
    : (data?.pages.flatMap(page => page.bookmarks) || []);

  useEffect(() => {
    // Clear search when following filter changes
  }, [showFollowsOnly]);

  let filteredBookmarks = allBookmarks;

  // Filter bookmarks based on tag filter would go here if we had a tag filter
  filteredBookmarks = allBookmarks.filter(bookmark => {
    return true;
  });

  // No additional sorting needed - use the order Nostr provides (newest first)

  const handleScroll = useCallback(() => {
    if (
      !isSearching &&
      window.innerHeight + document.documentElement.scrollTop
      >= document.documentElement.offsetHeight - 1000 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isSearching]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleDelete = (bookmark: Bookmark) => {
    deleteBookmark(bookmark.id, {
      onSuccess: () => {
        toast.success('Bookmark deleted');
      },
      onError: () => {
        toast.error('Failed to delete bookmark');
      },
    });
  };

  const canDelete = (bookmark: Bookmark) => {
    return user && user.pubkey === bookmark.pubkey;
  };

  const toggleComments = (bookmarkId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookmarkId)) {
        newSet.delete(bookmarkId);
      } else {
        newSet.add(bookmarkId);
      }
      return newSet;
    });
  };

  const hasBookmarkDescription = (bookmark: Bookmark) => {
    return bookmark.description && bookmark.description.trim().length > 0;
  };

  return (
    <div>
      {/* Search bar and filters */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
          <Input
            placeholder="Search bookmarks..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-7 text-sm bg-card"
          />
        </div>
        {user && follows.length > 0 && !pubkey && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-7 px-2 text-xs"
          >
            <Users className="h-3 w-3 mr-1" />
            {showFollowsOnly ? 'Follows' : 'Global'}
          </Button>
        )}
      </div>

      {/* Filter info */}
      {showFollowsOnly && follows.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
          <Users className="h-3 w-3" />
          {follows.length} connection{follows.length !== 1 ? 's' : ''}
          <button
            onClick={() => setShowFollowsOnly(false)}
            className="text-primary hover:underline"
          >
            switch to global
          </button>
        </div>
      )}
      {!showFollowsOnly && !pubkey && user && follows.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
          <Globe className="h-3 w-3" />
          <button
            onClick={() => setShowFollowsOnly(true)}
            className="text-primary hover:underline"
          >
            show from connections only
          </button>
        </div>
      )}

      {/* Results count */}
      {!isLoading && (
        <div className="text-xs text-muted-foreground mb-2">
          {filteredBookmarks.length} bookmark{filteredBookmarks.length !== 1 ? 's' : ''}
          {isSearching && searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}

      <div className="border-t">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{isSearching ? 'Searching...' : 'Loading...'}</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="text-center py-8 text-destructive text-xs">
            Failed to load bookmarks. Please try again.
          </div>
        )}

        {/* No results */}
        {filteredBookmarks.length === 0 && !isLoading && !error && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            {isSearching ? (
              `No bookmarks found for "${searchInput}"`
            ) : pubkey ? (
              'No bookmarks yet'
            ) : (
              'No bookmarks found'
            )}
          </div>
        )}

        {/* Bookmark list - HN style with avatars */}
        {!isLoading && !error && filteredBookmarks.length > 0 && (
          <div className="space-y-0">
            {filteredBookmarks.map((bookmark, index) => (
              <div key={bookmark.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors group">
                <div className="flex items-start gap-2 py-3 px-1">
                  {/* Number */}
                  <span className="text-muted-foreground text-xs min-w-[20px] tabular-nums pt-1 text-right">
                    {index + 1}.
                  </span>

                  {/* Avatar */}
                  <Link
                    to={`/profile/${nip19.npubEncode(bookmark.pubkey)}`}
                    className="mt-0.5 shrink-0"
                  >
                    <AuthorAvatar
                      pubkey={bookmark.pubkey}
                      className="w-5 h-5 bg-muted text-muted-foreground"
                    />
                  </Link>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title link */}
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-primary hover:underline leading-snug break-words"
                      >
                        {bookmark.title || new URL(bookmark.url).hostname}
                      </a>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-primary hover:underline shrink-0 mt-0.5"
                      >
                        ({new URL(bookmark.url).hostname})
                      </a>
                    </div>

                    {/* Metadata row */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] text-muted-foreground">
                      <Link
                        to={`/profile/${nip19.npubEncode(bookmark.pubkey)}`}
                        className="text-primary hover:underline"
                      >
                        {genUserName(bookmark.pubkey)}
                      </Link>
                      <span>{formatDistanceToNow(new Date(bookmark.createdAt * 1000), { addSuffix: true })}</span>
                      {bookmark.tags.length > 0 && (
                        <>
                          <span>|</span>
                          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                            {bookmark.tags.map((tag) => (
                              <span key={tag} className="text-muted-foreground/80">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                      {hasBookmarkDescription(bookmark) && (
                        <>
                          <span>|</span>
                          <button
                            onClick={() => {
                              const el = document.getElementById(`desc-${bookmark.id}`);
                              if (el) {
                                el.classList.toggle('hidden');
                              }
                            }}
                            className="text-primary hover:underline"
                          >
                            description
                          </button>
                        </>
                      )}
                      <span>|</span>
                      <button
                        onClick={() => toggleComments(bookmark.id)}
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        <MessageSquare className="h-2.5 w-2.5" />
                        discuss
                      </button>
                    </div>

                    {/* Collapsible description */}
                    {hasBookmarkDescription(bookmark) && (
                      <div
                        id={`desc-${bookmark.id}`}
                        className="hidden mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words max-w-[600px]"
                      >
                        {bookmark.description}
                      </div>
                    )}
                  </div>

                  {/* Delete button (owner only) */}
                  {canDelete(bookmark) && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Bookmark</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this bookmark? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(bookmark)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {/* Comments section */}
                {expandedComments.has(bookmark.id) && (
                  <div className="px-1 pb-3 pl-[78px]">
                    <CommentsSection
                      event={bookmark.event}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load more indicator */}
        {!isSearching && isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* End of results */}
        {!isSearching && !hasNextPage && allBookmarks.length > 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            End of bookmarks
          </div>
        )}
      </div>
    </div>
  );
}
