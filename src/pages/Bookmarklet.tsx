import { Layout } from '@/components/Layout';
import { toast } from 'sonner';

const Bookmarklet = () => {
  const bookmarkletCode = `javascript:(function(){
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open('${window.location.origin}/add?url=' + url + '&title=' + title, '_blank');
  })();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    toast.success('Copied to clipboard');
  };

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-sm font-medium mb-4">bookmarklet</h1>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Drag this link to your browser's bookmarks bar for one-click bookmarking:
          </p>

          <div className="py-3 px-4 border rounded-sm">
            <a
              href={bookmarkletCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-sm hover:bg-primary/90"
              onClick={(e) => e.preventDefault()}
            >
              <span>📌 Vibemarks</span>
            </a>
          </div>

          <div className="space-y-2">
            <p><strong className="text-foreground">How to use:</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Drag the button above to your browser's bookmarks bar</li>
              <li>Navigate to any page you want to bookmark</li>
              <li>Click the 📌 Vibemarks bookmark</li>
              <li>The bookmark form opens with the URL pre-filled</li>
            </ol>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="mb-2"><strong className="text-foreground">Or copy the code manually:</strong></p>
            <div className="p-3 bg-muted rounded-sm font-mono text-xs break-all mb-2">
              {bookmarkletCode}
            </div>
            <button
              onClick={copyBookmarklet}
              className="text-xs border border-border px-2 py-1 rounded-sm hover:bg-muted text-muted-foreground"
            >
              copy code
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Bookmarklet;
