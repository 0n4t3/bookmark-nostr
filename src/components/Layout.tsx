import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoginArea } from '@/components/auth/LoginArea';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Bookmark, Home, User, Plus, UserCircle, Search, Github, Menu, X, Code } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { nip19 } from 'nostr-tools';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user } = useCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navLinks = [
    { path: '/', label: 'home' },
    { path: '/search', label: 'search' },
    { path: '/bookmarklet', label: 'bookmarklet' },
    ...(user ? [
      { path: '/add', label: 'add' },
      { path: '/my-bookmarks', label: 'my bookmarks' },
      { path: `/profile/${nip19.npubEncode(user.pubkey)}`, label: 'profile' },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* HN-Style Top Bar */}
      <header className="topbar">
        <div className="max-w-5xl mx-auto px-2 py-1">
          <div className="flex items-center gap-1 text-sm leading-tight relative">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-1 font-bold text-white hover:underline shrink-0">
              <Bookmark className="h-4 w-4" />
              <span>mkpinja</span>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-1 ml-1">
              {navLinks.map((link) => (
                <span key={link.path} className="text-white/60">
                  {isActive(link.path) ? (
                    <span className="font-bold text-white underline">{link.label}</span>
                  ) : (
                    <Link to={link.path} className="hover:underline">{link.label}</Link>
                  )}
                </span>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="hidden md:flex items-center gap-1 ml-auto shrink-0">
              <ThemeToggle />
              <LoginArea className="max-w-48" />
            </div>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden ml-auto text-white p-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile Nav Dropdown */}
          {mobileMenuOpen && (
            <nav className="md:hidden py-2 border-t border-white/20 mt-1">
              <div className="flex flex-col gap-1 text-sm">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "text-white hover:underline py-1 px-1 rounded",
                      isActive(link.path) && "font-bold underline"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex items-center gap-2 px-1 pt-1 border-t border-white/20">
                  <ThemeToggle />
                  <LoginArea className="max-w-48" />
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Subtle separator bar */}
      <div className="bg-primary/5 border-b h-0"></div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-2 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-5xl mx-auto px-2 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" />
              <span>MKPinja - Decentralized bookmarking on Nostr</span>
              <span className="mx-1">•</span>
              <a 
                href="https://github.com/nostr-protocol/nips/blob/master/B0.md" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                NIP-B0
              </a>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/sepehr-safari/mkpinja"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <Github className="h-3 w-3" />
                Source
              </a>
              <span>Vibed with <a href="https://shakespeare.diy" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Shakespeare</a></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
