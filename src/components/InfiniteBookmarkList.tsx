import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { NostrMetadata, NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

type SortMode = 'new' | 'hot' | 'top';

interface EngagementScore {
  bookmarkId: string;
  score: number;
  reactionCount: number;
  commentCount: number;
}

interface BookmarkedWithScore extends Bookmark {
  _score: number;
  _reactionCount: number;
  _commentCount: number;
}

/**
 * Fetch engagement data for a batch of bookmarks.
 * Queries reactions (kind 7) and comments (kind 1) using the event IDs.
 * Returns a Map of bookmarkId -> { score, reactionCount, commentCount }.
 */
async function fetchEngagementScores(
  nostr: ReturnType<typeof useNostr>['nostr'],
  bookmarkIds: string[],
  timeWindowSeconds?: number,
): Promise<Map<string, EngagementScore>> {
  const scores = new Map<string, EngagementScore>();

  // Initialize all bookmarks with zero scores
  for (const id of bookmarkIds) {
    scores.set(id, { bookmarkId: id, score: 0, reactionCount: 0, commentCount: 0 });
  }

  if (bookmarkIds.length === 0) return scores;

  const cutoff = timeWindowSeconds ? Math.floor(Date.now() / 1000) - timeWindowSeconds : 0;
  const since = cutoff > 0 ? cutoff : undefined;

  // Nostr relays have filter limits, so we chunk the IDs
  const CHUNK_SIZE = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < bookmarkIds.length; i += CHUNK_SIZE) {
    chunks.push(bookmarkIds.slice(i, i + CHUNK_SIZE));
  }

  const allReactions: NostrEvent[] = [];
  const allComments: NostrEvent[] = [];

  // Fetch reactions and comments for each chunk
  for (const chunk of chunks) {
    try {
      const filters: Array<{ kinds: number[]; '#e': string[]; since?: number; limit: number }> = [
        { kinds: [7], '#e': chunk, limit: 100 },
        { kinds: [1], '#e': chunk, limit: 100 },
      ];
      if (since) {
        filters[0].since = since;
        filters[1].since = since;
      }

      const results = await nostr.query(filters, { signal: AbortSignal.timeout(8000) });
      for (const ev of results) {
        if (ev.kind === 7) allReactions.push(ev);
        else if (ev.kind === 1) allComments.push(ev);
      }
    } catch {
      // Chunk timed out or failed, continue with what we have
    }
  }

  // Count unique reactions per bookmark (deduplicate by pubkey)
  const reactionCounts = new Map<string, Set<string>>();
  for (const r of allReactions) {
    const eTags = r.tags.filter(t => t[0] === 'e');
    for (const eTag of eTags) {
      if (eTag[1] && scores.has(eTag[1])) {
        if (!reactionCounts.has(eTag[1])) reactionCounts.set(eTag[1], new Set());
        reactionCounts.get(eTag[1])!.add(r.pubkey);
      }
    }
  }

  // Count unique comments per bookmark (deduplicate by pubkey)
  const commentCounts = new Map<string, Set<string>>();
  for (const c of allComments) {
    const eTags = c.tags.filter(t => t[0] === 'e');
    for (const eTag of eTags) {
      if (eTag[1] && scores.has(eTag[1])) {
        if (!commentCounts.has(eTag[1])) commentCounts.set(eTag[1], new Set());
        commentCounts.get(eTag[1])!.add(c.pubkey);
      }
    }
  }

  // Compute final scores
  for (const [bookmarkId, entry] of scores) {
    const rx = reactionCounts.get(bookmarkId)?.size ?? 0;
    const cm = commentCounts.get(bookmarkId)?.size ?? 0;
    entry.reactionCount = rx;
    entry.commentCount = cm;
    entry.score = rx * 1 + cm * 1.5;
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
function InlineLikeButton({ event }: { event: NostrEvent }) {
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
  initialTag?: string;
}

export function InfiniteBookmarkList({ pubkey, showUserFilter = false, initialSearchTerm = '', title, initialTag }: InfiniteBookmarkListProps) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const [searchInput, setSearchInput] = useState(initialSearchTerm);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [showFollowsOnly, setShowFollowsOnly] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag || null);

  // Engagement scores
  const [engagementScores, setEngagementScores] = useState<Map<string, EngagementScore>>(new Map());
  const [scoresLoading, setScoresLoading] = useState(false);

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

  // Reset sort to 'new' when tag filter changes
  useEffect(() => {
    if (selectedTag) {
      setSortMode('new');
    }
  }, [selectedTag]);

  const { data: follows = [] } = useFollows(user?.pubkey);
  const authors = showFollowsOnly && follows.length > 0 ? follows : undefined;
  const isSearching = searchTerm.trim().length > 0;

  const infiniteQuery = useInfiniteBookmarks({
    pubkey,
    authors,
    pageSize: 60,
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

  // Time window
  const timeWindowSeconds = sortMode === 'hot' ? 24 * 60 * 60 : sortMode === 'top' ? 3 * 24 * 60 * 60 : undefined;

  // Fetch engagement scores when switching to hot/top
  const fetchCounter = useRef(0);
  useEffect(() => {
    const isEngagementMode = sortMode === 'hot' || sortMode === 'top';
    
    if (!isEngagementMode) {
      setScoresLoading(false);
      return;
    }

    if (allBookmarks.length === 0) return;

    // Increment fetch counter; cancel previous in-flight requests
    fetchCounter.current++;
    const currentFetch = fetchCounter.current;

    setScoresLoading(true);

    fetchEngagementScores(
      nostr,
      allBookmarks.map(b => b.id),
      timeWindowSeconds,
    ).then((scores) => {
      if (fetchCounter.current === currentFetch) {
        setEngagementScores(scores);
        setScoresLoading(false);
      }
    }).catch(() => {
      if (fetchCounter.current === currentFetch) {
        setScoresLoading(false);
      }
    });

    return () => {
      // This does NOT cancel — we rely on the counter check in .then
    };
  }, [sortMode, nostr, timeWindowSeconds, allBookmarks]);

  // Normalize the selected tag for comparison
  const normalizedSelectedTag = selectedTag?.trim().toLowerCase() || null;

  // Build the display list
  let displayBookmarks: Array<Bookmark & { _score?: number }> = allBookmarks;

  // Apply tag filter — normalize both sides for comparison
  if (normalizedSelectedTag) {
    displayBookmarks = displayBookmarks.filter(b => {
      const tags = b.tags || [];
      return tags.some(t => t.trim().toLowerCase() === normalizedSelectedTag);
    });
  }

  // Apply time window for hot/top
  if (timeWindowSeconds) {
    const cutoff = Math.floor(Date.now() / 1000) - timeWindowSeconds;
    displayBookmarks = displayBookmarks.filter(b => b.createdAt >= cutoff);
  }

  // Sort
  if (sortMode === 'hot' || sortMode === 'top') {
    // Sort by engagement score, then by recency as tiebreaker
    displayBookmarks = [...displayBookmarks].sort((a, b) => {
      const scoreA = engagementScores.get(a.id)?.score ?? 0;
      const scoreB = engagementScores.get(b.id)?.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt - a.createdAt;
    });
  } else {
    // Default: newest first
    displayBookmarks = [...displayBookmarks].sort((a, b) => b.createdAt - a.createdAt);
  }

  // Attach score data for render
  const scoredBookmarks: BookmarkedWithScore[] = displayBookmarks.map(b => ({
    ...b,
    _score: engagementScores.get(b.id)?.score ?? 0,
    _reactionCount: engagementScores.get(b.id)?.reactionCount ?? 0,
    _commentCount: engagementScores.get(b.id)?.commentCount ?? 0,
  }));

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
      onSuccess: () => toast.success('Bookmark deleted'),
      onError: () => toast.error('Failed to delete bookmark'),
    });
  };

  const canDelete = (bookmark: Bookmark) => user && user.pubkey === bookmark.pubkey;

  const toggleComments = (bookmarkId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookmarkId)) newSet.delete(bookmarkId);
      else newSet.add(bookmarkId);
      return newSet;
    });
  };

  const hasBookmarkDescription = (bookmark: Bookmark) => bookmark.description && bookmark.description.trim().length > 0;

  return (
    <div>
       {/* Sort tabs - HN style: new | hot | top | tags */}
       {!pubkey && !isSearching && (
         <div className="flex items-center gap-3 mb-3 text-xs">
           <span className="text-muted-foreground/60">view:</span>
           {[
             { mode: 'new' as SortMode, label: 'new', icon: ArrowUp },
             { mode: 'hot' as SortMode, label: 'hot', icon: TrendingUp },
             { mode: 'top' as SortMode, label: 'top', icon: Star },
           ].map(({ mode, label, icon: Icon }) => (
             <button
               key={mode}
               onClick={() => setSortMode(mode)}
               className={cn(
                 "flex items-center gap-1 pb-1 border-b-2 transition-colors uppercase",
                 sortMode === mode
                   ? "border-primary text-foreground font-medium"
                   : "border-transparent text-muted-foreground hover:text-foreground"
               )}
             >
               <Icon className="h-3 w-3" />
               {label}
             </button>
           ))}
           <Link
             to="/tags"
             className="flex items-center gap-1 pb-1 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors uppercase"
           >
             tags
           </Link>
           {(sortMode === 'hot' || sortMode === 'top') && scoresLoading && (
             <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
           )}
         </div>
       )}

      {/* Follows filter */}
      {!pubkey && user && follows.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
          {showFollowsOnly ? (
            <>
              {follows.length} connection{follows.length !== 1 ? 's' : ''}
              <button onClick={() => setShowFollowsOnly(false)} className="text-primary hover:underline">
                switch to global
              </button>
            </>
          ) : (
            <button onClick={() => setShowFollowsOnly(true)} className="text-primary hover:underline">
              show from connections only
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {!isLoading && (
        <div className="text-xs text-muted-foreground mb-2">
          {scoredBookmarks.length} bookmark{scoredBookmarks.length !== 1 ? 's' : ''}
          {selectedTag && ` tagged "${selectedTag}"`}
          {isSearching && searchTerm && ` matching "${searchTerm}"`}
        </div>
      )}

      <div className="border-t">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{isSearching ? 'Searching...' : 'Loading...'}</span>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center py-8 text-destructive text-xs">
            Failed to load bookmarks. Please try again.
          </div>
        )}

        {scoredBookmarks.length === 0 && !isLoading && !error && (
          <div className="text-center py-8 text-muted-foreground text-xs">
            {isSearching
              ? `No bookmarks found for "${searchInput}"`
              : pubkey
                ? 'No bookmarks yet'
                : selectedTag
                  ? `No bookmarks with tag "#${selectedTag}"`
                  : 'No bookmarks found'}
          </div>
        )}

        {scoredBookmarks.length > 0 && !isLoading && !error && (
          <div className="space-y-0">
            {scoredBookmarks.map((bookmark, index) => (
              <div key={bookmark.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors group">
                <div className="flex items-start gap-2 py-3 px-1">
                  {/* Number */}
                  <span className="text-muted-foreground text-xs min-w-[20px] tabular-nums pt-1 text-right">
                    {index + 1}.
                  </span>

                  {/* Avatar */}
                  <Link to={`/profile/${nip19.npubEncode(bookmark.pubkey)}`} className="mt-0.5 shrink-0">
                    <AuthorAvatar pubkey={bookmark.pubkey} className="w-5 h-5 bg-muted text-muted-foreground" />
                  </Link>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
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
                      <Link to={`/profile/${nip19.npubEncode(bookmark.pubkey)}`} className="text-primary hover:underline">
                        <AuthorName pubkey={bookmark.pubkey} />
                      </Link>
                      <span>{formatDistanceToNow(new Date(bookmark.createdAt * 1000), { addSuffix: true })}</span>

                      {/* Show score for hot/top modes */}
                      {(sortMode === 'hot' || sortMode === 'top') && bookmark._score > 0 && (
                        <>
                          <span className="text-primary font-medium">{bookmark._score}</span>
                        </>
                      )}

                      {hasBookmarkDescription(bookmark) && (
                        <>
                          <span>|</span>
                          <button
                            onClick={() => {
                              const el = document.getElementById(`desc-${bookmark.id}`);
                              if (el) el.classList.toggle('hidden');
                            }}
                            className="text-primary hover:underline"
                          >
                            description
                          </button>
                        </>
                      )}

                      {bookmark.tags.length > 0 && (
                        <>
                          <span>|</span>
                          {selectedTag && (
                            <button
                              onClick={() => setSelectedTag(null)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                            >
                              #{selectedTag}
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                          )}
                          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                            {bookmark.tags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                className={cn(
                                  "text-[11px] hover:text-primary transition-colors",
                                  tag === selectedTag ? "text-primary font-medium" : "text-muted-foreground/80"
                                )}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <span>|</span>
                      <InlineLikeButton event={bookmark.event} />
                      <span>|</span>
                      <button
                        onClick={() => toggleComments(bookmark.id)}
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        <MessageSquare className="h-2.5 w-2.5" />
                        discuss
                      </button>
                    </div>

                    {hasBookmarkDescription(bookmark) && (
                      <div
                        id={`desc-${bookmark.id}`}
                        className="hidden mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words max-w-[600px]"
                      >
                        {bookmark.description}
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
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
                            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(bookmark)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                    <CommentsSection event={bookmark.event} className="mt-2" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {!isSearching && isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* End */}
        {!isSearching && !hasNextPage && allBookmarks.length > 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground">
            End of bookmarks
          </div>
        )}
      </div>
    </div>
  );
}
