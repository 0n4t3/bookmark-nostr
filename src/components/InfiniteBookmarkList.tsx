import { useState, useEffect, useCallback } from 'react';
import { useInfiniteBookmarks, type Bookmark } from '@/hooks/useBookmarks';
import { useBookmarkSearch } from '@/hooks/useBookmarkSearch';
import { useFollows } from '@/hooks/useFollows';
import { useBookmarkDelete } from '@/hooks/useBookmarkPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useReactionStats } from '@/hooks/useReactions';
import { useReactionPublish, useReactionDelete } from '@/hooks/useReactionPublish';
import { useNostr } from '@nostrify/react';
import { useAuthor } from '@/hooks/useAuthor';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Loader2, MessageSquare, Heart, ArrowUp, TrendingUp, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { CommentsSection } from '@/components/CommentsSection';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';
import type { NostrMetadata } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

type SortMode = 'new' | 'hot' | 'top';

interface EngagementScore {
  bookmarkId: string;
  score: number;
  commentCount?: number;
  reactionCount?: number;
}

/** Compute engagement scores for a batch of bookmarks. */
async function computeEngagementScores(
  bookmarks: Bookmark[],
  nostr: ReturnType<typeof useNostr>['nostr'],
  timeWindowSeconds?: number,
): Promise<Map<string, EngagementScore>> {
  const scores = new Map<string, EngagementScore>();

  // Initialize all bookmarks with zero scores
  for (const b of bookmarks) {
    scores.set(b.id, { bookmarkId: b.id, score: 0 });
  }

  if (bookmarks.length === 0) return scores;

  // Filter bookmarks by time window if specified
  const cutoff = timeWindowSeconds
    ? Math.floor(Date.now() / 1000) - timeWindowSeconds
    : 0;
  const relevantBookmarks = cutoff > 0
    ? bookmarks.filter(b => b.createdAt >= cutoff)
    : bookmarks;

  if (relevantBookmarks.length === 0) return scores;

  // Batch query reactions (kind 7) for all bookmarks
  const bookmarkIds = relevantBookmarks.map(b => b.id);
  const since = cutoff > 0 ? cutoff : undefined;

  try {
    let reactions: Awaited<ReturnType<typeof nostr.query>> = [];
    try {
      const args: Parameters<typeof nostr.query>[] = since
        ? [[{ kinds: [7], '#e': bookmarkIds, since }]]
        : [[{ kinds: [7], '#e': bookmarkIds }]];
      reactions = await nostr.query(...args);
    } catch {
      reactions = [];
    }

    const querySignal = AbortSignal.timeout(5000);

    let comments: Awaited<ReturnType<typeof nostr.query>> = [];
    try {
      const args: Parameters<typeof nostr.query>[] = since
        ? [[{ kinds: [1], '#e': bookmarkIds, since }]]
        : [[{ kinds: [1], '#e': bookmarkIds }]];
      comments = await nostr.query(...args, { signal: querySignal });
    } catch {
      comments = [];
    }

    // Count unique reactions per bookmark (deduplicate by pubkey)
    const reactionMap = new Map<string, Set<string>>();
    for (const r of reactions) {
      const eTags = r.tags.filter(t => t[0] === 'e');
      for (const eTag of eTags) {
        if (eTag[1] && scores.has(eTag[1])) {
          if (!reactionMap.has(eTag[1])) {
            reactionMap.set(eTag[1], new Set());
          }
          reactionMap.get(eTag[1])!.add(r.pubkey);
        }
      }
    }

    // Count unique comments per bookmark (deduplicate by pubkey)
    const commentMap = new Map<string, Set<string>>();
    for (const c of comments) {
      const eTags = c.tags.filter(t => t[0] === 'e');
      for (const eTag of eTags) {
        if (eTag[1] && scores.has(eTag[1])) {
          if (!commentMap.has(eTag[1])) {
            commentMap.set(eTag[1], new Set());
          }
          commentMap.get(eTag[1])!.add(c.pubkey);
        }
      }
    }

    // Compute scores
    for (const [bookmarkId, entry] of scores) {
      const reactionCount = reactionMap.get(bookmarkId)?.size ?? 0;
      const commentCount = commentMap.get(bookmarkId)?.size ?? 0;
      entry.reactionCount = reactionCount;
      entry.commentCount = commentCount;
      entry.score = reactionCount * 1 + commentCount * 1.5;
    }
  } catch {
    // If engagement query fails, scores stay at 0
  }

  return scores;
}

/** Small HN-style avatar for bookmark authors */
function AuthorAvatar({ pubkey, className = '' }: { pubkey: string; className?: string }) {
  const author = useAuthor(pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;
  const name = metadata?.display_name || metadata?.name || genUserName(pubkey);
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

/** Display author name, falling back to generated name */
function AuthorName({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;

  const displayName = metadata?.display_name || metadata?.name || genUserName(pubkey);

  return <span>{displayName}</span>;
}

/** Compact HN-style inline like button */
function InlineLikeButton({ event, bookmarkId }: { event: NostrEvent; bookmarkId: string }) {
  const { user } = useCurrentUser();
  const { likes, hasUserLiked, userReaction } = useReactionStats(event, user?.pubkey);
  const { mutate: publishReaction, isPending: isPublishing } = useReactionPublish();
  const { mutate: deleteReaction, isPending: isDeleting } = useReactionDelete();

  const isPending = isPublishing || isDeleting;

  const handleToggle = () => {
    if (!user) {
      toast.error('Please log in to like');
      return;
    }

    if (hasUserLiked && userReaction) {
      deleteReaction(userReaction.event, {
        onSuccess: () => toast.success('Like removed'),
        onError: () => toast.error('Failed to remove like'),
      });
    } else {
      publishReaction({
        targetEvent: event,
        content: '+',
      }, {
        onSuccess: () => toast.success('Liked!'),
        onError: () => toast.error('Failed to like'),
      });
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary transition-colors",
        hasUserLiked && "text-primary"
      )}
    >
      <Heart className={cn("h-2.5 w-2.5", hasUserLiked && "fill-current")} />
      {likes > 0 ? likes : ''}
    </button>
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
  const { nostr } = useNostr();
  const [searchInput, setSearchInput] = useState(initialSearchTerm);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [showFollowsOnly, setShowFollowsOnly] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [loadingScores, setLoadingScores] = useState(false);

  // Time window in seconds for Hot (24 hours) and Top (3 days)
  const timeWindowSeconds = sortMode === 'hot' ? 24 * 60 * 60 : sortMode === 'top' ? 3 * 24 * 60 * 60 : undefined;

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

  // Compute engagement scores for hot/top modes
  const [engagementScores, setEngagementScores] = useState<Map<string, EngagementScore>>(new Map());

  useEffect(() => {
    if (sortMode === 'new' || allBookmarks.length === 0) {
      setEngagementScores(new Map());
      return;
    }

    let cancelled = false;
    setLoadingScores(true);

    computeEngagementScores(allBookmarks, nostr, timeWindowSeconds)
      .then((scores) => {
        if (!cancelled) {
          setEngagementScores(scores);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoadingScores(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sortMode, allBookmarks, nostr, timeWindowSeconds]);

  let filteredBookmarks = allBookmarks;

  // Apply time-based filtering and sorting
  if (sortMode === 'hot') {
    // Hot: created within 24 hours, sorted by engagement (score desc, then recency)
    const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    filteredBookmarks = allBookmarks.filter(b => b.createdAt >= cutoff);
    filteredBookmarks = [...filteredBookmarks].sort((a, b) => {
      const scoreA = engagementScores.get(a.id)?.score ?? 0;
      const scoreB = engagementScores.get(b.id)?.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt - a.createdAt; // tiebreaker: newest first
    });
  } else if (sortMode === 'top') {
    // Top: created within 3 days, sorted by engagement (score desc, then recency)
    const cutoff = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
    filteredBookmarks = allBookmarks.filter(b => b.createdAt >= cutoff);
    filteredBookmarks = [...filteredBookmarks].sort((a, b) => {
      const scoreA = engagementScores.get(a.id)?.score ?? 0;
      const scoreB = engagementScores.get(b.id)?.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt - a.createdAt;
    });
  } else if (!isSearching) {
    // New: reverse chronological (as received from Nostr)
    filteredBookmarks = [...allBookmarks].sort((a, b) => b.createdAt - a.createdAt);
  }

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
      {/* Sort tabs - HN style: New | Hot | Top */}
      {!pubkey && !isSearching && (
        <div className="flex items-center gap-3 mb-3 text-xs">
          <button
            onClick={() => setSortMode('new')}
            className={cn(
              "flex items-center gap-1 pb-1 border-b-2 transition-colors",
              sortMode === 'new'
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowUp className="h-3 w-3" />
            New
          </button>
          <button
            onClick={() => setSortMode('hot')}
            className={cn(
              "flex items-center gap-1 pb-1 border-b-2 transition-colors",
              sortMode === 'hot'
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <TrendingUp className="h-3 w-3" />
            Hot
          </button>
          <button
            onClick={() => setSortMode('top')}
            className={cn(
              "flex items-center gap-1 pb-1 border-b-2 transition-colors",
              sortMode === 'top'
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className="h-3 w-3" />
            Top
          </button>
          {(sortMode === 'hot' || sortMode === 'top') && loadingScores && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* Follows filter - only on public/home view */}
      {!pubkey && user && follows.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
          {showFollowsOnly ? (
            <>
              {follows.length} connection{follows.length !== 1 ? 's' : ''}
              <button
                onClick={() => setShowFollowsOnly(false)}
                className="text-primary hover:underline"
              >
                switch to global
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowFollowsOnly(true)}
              className="text-primary hover:underline"
            >
              show from connections only
            </button>
          )}
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
                        <AuthorName pubkey={bookmark.pubkey} />
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
                      <InlineLikeButton event={bookmark.event} bookmarkId={bookmark.id} />
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
