import { Layout } from '@/components/Layout';
import { BookmarkForm } from '@/components/BookmarkForm';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AddBookmark = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('url') || '';
  const initialTitle = searchParams.get('title') || '';

  const handleSuccess = () => {
    navigate('/my-bookmarks');
  };

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-sm font-medium mb-4">add bookmark</h1>
        <BookmarkForm onSuccess={handleSuccess} initialUrl={initialUrl} initialTitle={initialTitle} />
      </div>
    </Layout>
  );
};

export default AddBookmark;
