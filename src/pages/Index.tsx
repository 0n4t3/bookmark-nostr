import { Layout } from '@/components/Layout';
import { InfiniteBookmarkList } from '@/components/InfiniteBookmarkList';

const Index = () => {
  return (
    <Layout>
      <div>
        <InfiniteBookmarkList showUserFilter={true} />
      </div>
    </Layout>
  );
};

export default Index;
