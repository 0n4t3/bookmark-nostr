import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";

// Lazy load page components
const Index = lazy(() => import("./pages/Index"));
const AddBookmark = lazy(() => import("./pages/AddBookmark"));
const MyBookmarks = lazy(() => import("./pages/MyBookmarks"));
const Search = lazy(() => import("./pages/Search"));
const Bookmarklet = lazy(() => import("./pages/Bookmarklet"));
const Profile = lazy(() => import("./pages/Profile"));
const Tags = lazy(() => import("./pages/Tags"));
const NotFound = lazy(() => import("./pages/NotFound"));

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/add" element={<AddBookmark />} />
        <Route path="/my-bookmarks" element={<MyBookmarks />} />
        <Route path="/search" element={<Search />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/bookmarklet" element={<Bookmarklet />} />
        <Route path="/profile/:pubkey" element={<Profile />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;