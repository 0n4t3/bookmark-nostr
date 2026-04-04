import { Layout } from '@/components/Layout';
import { InfiniteBookmarkList } from '@/components/InfiniteBookmarkList';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { User, Plus } from 'lucide-react';

const MyBookmarks = () => {
  const { user } = useCurrentUser();

  if (!user) {
    return (
      <Layout>
        <div className="text-center py-12 text-sm text-muted-foreground">
          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Please log in to view your bookmarks.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-medium">bookmarks</h1>
        <Button asChild variant="ghost" className="h-6 text-xs px-2">
          <Link to="/add" className="flex items-center gap-1">
            <Plus className="h-3 w-3" />
            <span>add</span>
          </Link>
        </Button>
      </div>
      <InfiniteBookmarkList pubkey={user.pubkey} />
    </Layout>
  );
};

export default MyBookmarks;
