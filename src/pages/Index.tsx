import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { InfiniteBookmarkList } from '@/components/InfiniteBookmarkList';

const Index = () => {
  const [searchParams] = useSearchParams();
  const tagFromUrl = searchParams.get('tag') || undefined;

  return (
    <Layout>
      <div>
        <InfiniteBookmarkList showUserFilter={true} initialTag={tagFromUrl} />
      </div>
    </Layout>
  );
};

export default Index;
