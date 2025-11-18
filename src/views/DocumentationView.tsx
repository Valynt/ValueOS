import React, { useState, useEffect } from 'react';
import { Search, Book, Home, ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { announceToScreenReader } from '../utils/accessibility';
import { sanitizeHtml } from '../utils/sanitizeHtml';

interface DocCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface DocPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category_id: string;
  view_count: number;
}

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  category_name: string;
  rank: number;
}

export function DocumentationView() {
  const [view, setView] = useState<'home' | 'category' | 'page'>('home');
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [popularPages, setPopularPages] = useState<DocPage[]>([]);
  const [currentPage, setCurrentPage] = useState<DocPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>(['Documentation']);

  useEffect(() => {
    loadCategories();
    loadPopularPages();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('doc_categories')
      .select('*')
      .eq('published', true)
      .order('display_order');

    if (data) setCategories(data);
  };

  const loadPopularPages = async () => {
    const { data } = await supabase
      .from('popular_pages')
      .select('*')
      .limit(6);

    if (data) setPopularPages(data as any);
  };

  const performSearch = async () => {
    const { data } = await supabase.rpc('search_documentation', {
      search_query: searchQuery,
      category_filter: null,
      limit_count: 10,
    });

    if (data) {
      setSearchResults(data);
    }
  };

  const openPage = async (slug: string) => {
    const { data } = await supabase
      .from('doc_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (data) {
      setCurrentPage(data);
      setView('page');
      setBreadcrumbs(['Documentation', data.title]);

      await supabase.from('doc_analytics').insert({
        page_id: data.id,
        event_type: 'view',
      });

      announceToScreenReader(`Viewing ${data.title}`, 'polite');
    }
  };

  const submitFeedback = async (helpful: boolean) => {
    if (!currentPage) return;

    await supabase.from('doc_feedback').insert({
      page_id: currentPage.id,
      helpful,
      feedback_type: 'helpful',
    });

    announceToScreenReader('Thank you for your feedback', 'polite');
  };

  const goHome = () => {
    setView('home');
    setCurrentPage(null);
    setBreadcrumbs(['Documentation']);
    announceToScreenReader('Returned to documentation home', 'polite');
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Book className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
            </div>

            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Search documentation"
                />

                {searchResults.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          openPage(result.slug);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full text-left p-4 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <h3 className="font-medium text-gray-900">{result.title}</h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {result.description}
                        </p>
                        <span className="text-xs text-gray-500 mt-1 inline-block">
                          {result.category_name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {view !== 'home' && (
              <button
                onClick={goHome}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:text-gray-900"
                aria-label="Go to documentation home"
              >
                <Home className="w-5 h-5" />
                <span>Home</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <nav aria-label="Breadcrumb" className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <ol className="flex items-center space-x-2 text-sm">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                  <span className={index === breadcrumbs.length - 1 ? 'font-medium' : 'text-gray-600'}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {view === 'home' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Welcome to Documentation
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Everything you need to get started, build, and succeed with our platform
              </p>
            </div>

            {/* Categories Grid */}
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Browse by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      setView('category');
                      setBreadcrumbs(['Documentation', category.name]);
                    }}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="text-4xl">{category.icon}</div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          {category.name}
                        </h4>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular Articles */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Popular Articles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {popularPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => openPage(page.slug)}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow text-left"
                  >
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {page.title}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {page.description}
                    </p>
                    <div className="mt-4 flex items-center text-xs text-gray-500">
                      <span>{page.view_count} views</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'page' && currentPage && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <article className="bg-white rounded-lg shadow-sm p-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {currentPage.title}
              </h1>

              {currentPage.description && (
                <p className="text-xl text-gray-600 mb-8">
                  {currentPage.description}
                </p>
              )}

              <div
                className="prose prose-blue max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentPage.content) }}
              />

              {/* Feedback Section */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Was this page helpful?
                </h3>
                <div className="flex space-x-4">
                  <button
                    onClick={() => submitFeedback(true)}
                    className="flex items-center space-x-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-500 transition-colors"
                    aria-label="Yes, this was helpful"
                  >
                    <ThumbsUp className="w-5 h-5" />
                    <span>Yes</span>
                  </button>
                  <button
                    onClick={() => submitFeedback(false)}
                    className="flex items-center space-x-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-500 transition-colors"
                    aria-label="No, this was not helpful"
                  >
                    <ThumbsDown className="w-5 h-5" />
                    <span>No</span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        )}
      </main>
    </div>
  );
}
