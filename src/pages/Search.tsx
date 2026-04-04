import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { InfiniteBookmarkList } from '@/components/InfiniteBookmarkList';
import { Search as SearchIcon } from 'lucide-react';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [currentQuery, setCurrentQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchInput(query);
    setCurrentQuery(query);
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
      setCurrentQuery(trimmed);
    } else {
      setSearchParams({});
      setCurrentQuery('');
    }
  };

  return (
    <Layout>
      <div>
        <div className="text-sm mb-4 text-muted-foreground">
          <span className="font-medium">search bookm</span>arks
          {currentQuery && <span className="ml-1">for "{currentQuery}"</span>}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, description, URL, or tags..."
              className="w-full h-7 text-sm px-3 pl-8 bg-card border border-border rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={!searchInput.trim()}
            className="h-7 px-3 text-xs bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            search
          </button>
          {currentQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchParams({});
                setCurrentQuery('');
              }}
              className="h-7 px-3 text-xs border border-border rounded-sm hover:bg-muted"
            >
              clear
            </button>
          )}
        </form>

        {currentQuery ? (
          <InfiniteBookmarkList
            key={currentQuery}
            showUserFilter={true}
            initialSearchTerm={currentQuery}
          />
        ) : (
          <div className="text-center py-16 text-muted-foreground text-xs">
            <SearchIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Enter a search term to search bookmarks</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Search;
