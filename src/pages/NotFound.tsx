import { Link } from "react-router-dom";
import { Layout } from '@/components/Layout';

const NotFound = () => {
  return (
    <Layout>
      <div className="text-center py-16">
        <h1 className="text-2xl font-mono text-muted-foreground mb-2">404</h1>
        <p className="text-sm text-muted-foreground mb-4">
          page not found
        </p>
        <Link to="/" className="text-xs text-primary hover:underline">
          go home
        </Link>
      </div>
    </Layout>
  );
};

export default NotFound;
