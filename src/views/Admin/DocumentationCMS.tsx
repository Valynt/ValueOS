/**
 * Documentation CMS (Content Management System)
 * 
 * Admin interface for managing documentation pages:
 * - Create/edit/delete pages
 * - Version history
 * - Draft/published states
 * - Category management
 * - Media uploads
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sanitizeHtml } from '../../utils/sanitizeHtml';

interface DocPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category_id: string;
  status: 'draft' | 'published' | 'archived';
  version: string;
  featured: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface DocCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export const DocumentationCMS: React.FC = () => {
  const [pages, setPages] = useState<DocPage[]>([]);
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [selectedPage, setSelectedPage] = useState<DocPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPages();
    loadCategories();
  }, [filterStatus, searchQuery]);

  const loadPages = async () => {
    setLoading(true);

    let query = (supabase as any)
      .from('doc_pages')
      .select('*')
      .order('updated_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (data && !error) {
      setPages(data);
    }

    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await (supabase as any)
      .from('doc_categories')
      .select('*')
      .order('display_order');

    if (data) {
      setCategories(data);
    }
  };

  const createNewPage = () => {
    const newPage: DocPage = {
      id: '',
      slug: '',
      title: '',
      description: '',
      content: '',
      category_id: categories[0]?.id || '',
      status: 'draft',
      version: '1.0.0',
      featured: false,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSelectedPage(newPage);
    setIsEditing(true);
  };

  const savePage = async () => {
    if (!selectedPage) return;

    // Generate slug from title if empty
    if (!selectedPage.slug) {
      selectedPage.slug = selectedPage.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const pageData = {
      ...selectedPage,
      updated_at: new Date().toISOString(),
    };

    if (selectedPage.id) {
      // Update existing page
      const { error } = await (supabase as any)
        .from('doc_pages')
        .update(pageData)
        .eq('id', selectedPage.id);

      if (!error) {
        // Create version history entry
        await (supabase as any).from('doc_versions').insert({
          page_id: selectedPage.id,
          version: selectedPage.version,
          title: selectedPage.title,
          content: selectedPage.content,
          content_type: 'markdown',
          change_summary: 'Updated via CMS',
        });
      }
    } else {
      // Create new page
      const { data, error } = await (supabase as any)
        .from('doc_pages')
        .insert(pageData)
        .select()
        .single();

      if (data && !error) {
        setSelectedPage(data);
      }
    }

    loadPages();
    setIsEditing(false);
  };

  const deletePage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    await (supabase as any).from('doc_pages').delete().eq('id', pageId);
    loadPages();
    setSelectedPage(null);
  };

  const publishPage = async (pageId: string) => {
    await (supabase as any)
      .from('doc_pages')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', pageId);

    loadPages();
  };

  const unpublishPage = async (pageId: string) => {
    await (supabase as any)
      .from('doc_pages')
      .update({ status: 'draft' })
      .eq('id', pageId);

    loadPages();
  };

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: <Edit className="w-3 h-3" /> },
      published: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      archived: { color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-3 h-3" /> },
    };

    const { color, icon } = config[status as keyof typeof config] || config.draft;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${color}`}>
        {icon}
        {status}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Page List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Documentation CMS</h2>
            <button
              onClick={createNewPage}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Create new page"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Pages</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Page List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPage(page)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedPage?.id === page.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 line-clamp-1">{page.title}</h3>
                    {getStatusBadge(page.status)}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">{page.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(page.updated_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && pages.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No pages found</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Editor */}
      <div className="flex-1 flex flex-col">
        {selectedPage ? (
          <>
            {/* Editor Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isEditing ? 'Edit Page' : 'View Page'}
                  </h2>
                  {getStatusBadge(selectedPage.status)}
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>

                      {selectedPage.status === 'draft' && (
                        <button
                          onClick={() => publishPage(selectedPage.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Publish</span>
                        </button>
                      )}

                      {selectedPage.status === 'published' && (
                        <button
                          onClick={() => unpublishPage(selectedPage.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span>Unpublish</span>
                        </button>
                      )}

                      <button
                        onClick={() => deletePage(selectedPage.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}

                  {isEditing && (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          loadPages();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                      </button>

                      <button
                        onClick={savePage}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isEditing ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={selectedPage.title}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, title: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Page title"
                    />
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={selectedPage.slug}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, slug: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="page-slug (auto-generated if empty)"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={selectedPage.description}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, description: e.target.value })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={selectedPage.category_id}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, category_id: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content (Markdown) *
                    </label>
                    <textarea
                      value={selectedPage.content}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, content: e.target.value })
                      }
                      rows={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="# Page Content\n\nWrite your content in Markdown..."
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={selectedPage.tags.join(', ')}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          tags: e.target.value.split(',').map((t) => t.trim()),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>

                  {/* Featured */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={selectedPage.featured}
                      onChange={(e) =>
                        setSelectedPage({ ...selectedPage, featured: e.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="featured" className="text-sm font-medium text-gray-700">
                      Featured page
                    </label>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <article className="prose prose-blue max-w-none">
                    <h1>{selectedPage.title}</h1>
                    {selectedPage.description && <p className="lead">{selectedPage.description}</p>}
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedPage.content) }} />
                  </article>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg mb-2">No page selected</p>
              <p className="text-sm">Select a page from the list or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
