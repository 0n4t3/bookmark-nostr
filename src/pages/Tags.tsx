import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useInfiniteBookmarks } from '@/hooks/useBookmarks';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface TagCount {
  tag: string;
  count: number;
}

const Tags = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [loadedPages, setLoadedPages] = useState(2);

  // Fetch a good chunk of bookmarks to build tag stats
  const { data, fetchNextPage, isLoading, hasNextPage, isFetchingNextPage } = useInfiniteBookmarks({
    pubkey: undefined,
  });

  // Auto-load first few pages for tag data
  const { data: initialData } = useInfiniteBookmarks({
    pubkey: undefined,
    pageSize: 100,
  });

  // Collect all unique tags with counts
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const allBookmarks = initialData?.pages.flatMap(page => page.bookmarks) || [];

    for (const bookmark of allBookmarks) {
      for (const tag of bookmark.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [initialData]);

  const handleTagClick = (tag: string) => {
    navigate(`/?tag=${encodeURIComponent(tag)}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading tags...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div className="text-sm mb-4 text-muted-foreground flex items-center gap-2">
          <Link to="/" className="hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <span>tags</span>
        </div>

        {tagCounts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-xs">
            <p>No tags found yet</p>
          </div>
        ) : (
          <div className="border-t">
            {/* Tag cloud */}
            <div className="py-4">
              <div className="flex flex-wrap gap-2">
                {tagCounts.map(({ tag, count }) => {
                  // Font size scaled by count
                  const sizeClass = count > 50
                    ? 'text-lg'
                    : count > 30
                    ? 'text-base'
                    : count > 20
                    ? 'text-sm'
                    : count > 10
                    ? 'text-xs'
                    : 'text-[11px]';

                  const fontWeight = count > 20 ? 'font-medium' : '';

                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`px-2.5 py-1.5 rounded-sm bg-card border border-border hover:border-primary hover:text-primary transition-colors ${sizeClass} ${fontWeight}`}
                    >
                      #{tag}
                      <span className="ml-1 text-muted-foreground/60 text-[10px]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Load more for broader tag coverage */}
            {hasNextPage && tagCounts.length < 200 && (
              <div className="flex justify-center pb-8">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-xs"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Loading more...
                    </>
                  ) : (
                    'Load more tags'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Tags;
