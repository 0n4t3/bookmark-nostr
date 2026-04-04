import { useState, useRef, useEffect } from 'react';
import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LoginArea } from '@/components/auth/LoginArea';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RelaySelector } from '@/components/RelaySelector';
import { Bookmark, Search, ChevronDown } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="topbar">
        <div className="max-w-5xl mx-auto px-2 py-1">
          <div className="flex items-center gap-2 text-sm leading-tight">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-1 font-bold text-white hover:underline shrink-0">
              <Bookmark className="h-4 w-4" />
              <span>mkpinja</span> 🐧
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden sm:flex items-center gap-1 ml-1">
              <Link
                to="/"
                className={cn(
                  'text-white hover:underline',
                  location.pathname === '/' ? 'font-bold underline' : 'text-white/60'
                )}
              >
                home
              </Link>
              <Link
                to="/tags"
                className={cn(
                  'text-white hover:underline',
                  location.pathname === '/tags' ? 'font-bold underline' : 'text-white/60'
                )}
              >
                tags
              </Link>
              {user && (
                <>
                  <Link
                    to="/add"
                    className={cn(
                      'text-white/60 hover:underline',
                      location.pathname === '/add' ? 'font-bold text-white underline' : ''
                    )}
                  >
                    add
                  </Link>
                  <Link
                    to="/my-bookmarks"
                    className={cn(
                      'text-white/60 hover:underline',
                      location.pathname === '/my-bookmarks' ? 'font-bold text-white underline' : ''
                    )}
                  >
                    bookmarks
                  </Link>
                </>
              )}
            </nav>

            {/* Right side actions */}
            <div className="hidden sm:flex items-center gap-1.5 ml-auto shrink-0">
              {/* Search */}
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center gap-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    autoFocus
                    className="h-5 w-40 text-xs px-1 bg-white/20 border-0 rounded text-white placeholder-white/50 focus:outline-none focus:bg-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="p-0.5 text-white/60 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="p-1 text-white/60 hover:text-white"
                  aria-label="Search bookmarks"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}

              <ThemeToggle light />

              {/* Profile dropdown */}
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1 text-white/80 hover:text-white text-xs"
                >
                  {user ? (
                    <>
                      {user.metadata?.picture ? (
                        <img
                          src={user.metadata.picture}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">
                          {(user.metadata?.display_name || user.metadata?.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="max-w-[80px] truncate">
                        {user.metadata?.display_name || user.metadata?.name || user.pubkey.slice(0, 8)}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </>
                  ) : (
                    <span>login</span>
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-6 z-50 bg-card border rounded shadow-lg py-2 w-52">
                    {user ? (
                      <>
                        <Link
                          to={`/profile/${user.pubkey}`}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-foreground"
                        >
                          Profile
                        </Link>

                        <div className="border-t my-1" />
                        <div className="px-2 pb-2">
                          <LoginArea className="w-full" />
                        </div>
                        <button
                          onClick={() => {
                            if (currentUser) {
                              removeLogin(currentUser.id);
                            }
                            setProfileOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-accent"
                        >
                          Logout
                        </button>
                      </>
                    ) : (
                      <div className="px-2 pb-2">
                        <LoginArea className="w-full" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: search, theme toggle, menu toggle */}
            <div className="sm:hidden flex items-center gap-1 ml-auto">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center gap-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    autoFocus
                    className="h-5 w-28 text-xs px-1 bg-white/20 border-0 rounded text-white placeholder-white/50 focus:outline-none focus:bg-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="p-0.5 text-white/60 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="p-1 text-white/60 hover:text-white"
                  aria-label="Search bookmarks"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}

              <ThemeToggle light />

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-0.5 text-white hover:text-white/80"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="sm:hidden py-2 border-t border-white/20 mt-1">
            <div className="flex flex-col gap-1 text-sm px-1">
              {user && (
                <>
                  <Link
                    to="/add"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "text-white hover:underline py-1 px-1",
                      location.pathname === '/add' && "font-bold underline"
                    )}
                  >
                    add bookmark
                  </Link>
                  <Link
                    to="/my-bookmarks"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "text-white hover:underline py-1 px-1",
                      location.pathname === '/my-bookmarks' && "font-bold underline"
                    )}
                  >
                    my bookmarks
                  </Link>
                  <Link
                    to={`/profile/${user.pubkey}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-white/60 hover:underline py-1 px-1"
                  >
                    profile
                  </Link>
                </>
              )}
              {!user && (
                <div className="py-1 px-1">
                  <LoginArea className="w-full" />
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-2 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-5xl mx-auto px-2 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" />
              <span>MKPinja — Decentralized bookmarking on Nostr</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Relay selector in footer */}
              <RelaySelector className="h-6 text-xs" />
              <a
                href="https://github.com/nostr-protocol/nips/blob/master/B0.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                NIP-B0
              </a>
              <span className="text-muted-foreground/40">·</span>
              <a
                href="https://github.com/sepehr-safari/mkpinja"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                Source
              </a>
            </div>
            <div className="text-[10px] text-muted-foreground/60">
              Vibed with <a href="https://shakespeare.diy" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Shakespeare</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
