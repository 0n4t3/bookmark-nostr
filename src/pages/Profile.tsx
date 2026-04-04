import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuthor } from '@/hooks/useAuthor';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollows } from '@/hooks/useFollows';
import { genUserName } from '@/lib/genUserName';
import { Button } from '@/components/ui/button';
import { InfiniteBookmarkList } from '@/components/InfiniteBookmarkList';
import { ExternalLink, Mail, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import type { NostrMetadata } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

const Profile = () => {
  const { pubkey: pubkeyParam } = useParams<{ pubkey: string }>();
  const { user } = useCurrentUser();
  const [copiedNpub, setCopiedNpub] = useState(false);

  let pubkey: string;
  let isValidPubkey = true;

  try {
    if (pubkeyParam?.startsWith('npub')) {
      const decoded = nip19.decode(pubkeyParam);
      if (decoded.type === 'npub') {
        pubkey = decoded.data;
      } else {
        isValidPubkey = false;
        pubkey = '';
      }
    } else {
      pubkey = pubkeyParam || '';
    }
  } catch {
    isValidPubkey = false;
    pubkey = '';
  }

  const author = useAuthor(isValidPubkey ? pubkey : undefined);
  const { data: bookmarks = [] } = useBookmarks(isValidPubkey ? pubkey : undefined);
  const { data: follows = [] } = useFollows(isValidPubkey ? pubkey : undefined);

  if (!isValidPubkey) {
    return (
      <Layout>
        <div className="text-center py-16">
          <h1 className="text-lg font-medium text-destructive mb-2">Invalid Profile</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The profile identifier is not valid.
          </p>
          <Link to="/" className="text-xs text-primary hover:underline">
            go home
          </Link>
        </div>
      </Layout>
    );
  }

  const metadata: NostrMetadata | undefined = author.data?.metadata;
  const isOwnProfile = user?.pubkey === pubkey;

  const displayName = metadata?.display_name || metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;
  const npub = nip19.npubEncode(pubkey);

  const handleCopyNpub = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopiedNpub(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedNpub(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (author.isLoading) {
    return (
      <Layout>
        <div className="py-8 text-sm text-muted-foreground">
          Loading profile...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        {/* Profile header */}
        <div className="flex items-start gap-4 mb-6">
          {profileImage && (
            <img
              src={profileImage}
              alt={`${displayName}'s avatar`}
              className="w-16 h-16 rounded-sm object-cover border"
            />
          )}
          {!profileImage && (
            <div className="w-16 h-16 rounded-sm bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground border">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold">{displayName}</h1>
            {metadata?.display_name && metadata?.name && metadata.display_name !== metadata.name && (
              <p className="text-sm text-muted-foreground">@{metadata.name}</p>
            )}

            {metadata?.about && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                {metadata.about}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              {metadata?.website && (
                <a
                  href={metadata.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {new URL(metadata.website).hostname}
                </a>
              )}
              {metadata?.nip05 && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {metadata.nip05}
                </div>
              )}
            </div>

            {/* Npub */}
            <div className="flex items-center gap-1 mt-2">
              <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">
                {npub}
              </code>
              <Button
                onClick={handleCopyNpub}
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
              >
                {copiedNpub ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs text-muted-foreground mb-6 pb-4 border-b">
          <div>
            <span className="font-semibold text-foreground">{bookmarks.length}</span> bookmark{bookmarks.length !== 1 ? 's' : ''}
          </div>
          <div>
            <span className="font-semibold text-foreground">{follows.length}</span> follow{follows.length !== 1 ? 's' : ''}
          </div>
          <div>
            {metadata ? 'profile set up ✓' : 'no profile'}
          </div>
        </div>

        {/* Bookmarks */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">
            {isOwnProfile ? 'your bookmarks' : `${displayName}'s bookmarks`}
          </h2>
          {isOwnProfile && (
            <Button asChild variant="ghost" className="h-6 text-xs px-2">
              <Link to="/add">add bookmark</Link>
            </Button>
          )}
        </div>

        <InfiniteBookmarkList pubkey={pubkey} />
      </div>
    </Layout>
  );
};

export default Profile;
