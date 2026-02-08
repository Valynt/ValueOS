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

import React, { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  FileText,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SafeHtml } from "../../components/security/SafeHtml";

interface DocPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category_id: string;
  status: "draft" | "published" | "archived";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPages();
    loadCategories();
  }, [filterStatus, searchQuery]);

  const loadPages = async () => {
    setLoading(true);

    let query = (supabase as any)
      .from("doc_pages")
      .select("*")
      .order("updated_at", { ascending: false });

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    if (searchQuery) {
      query = query.or(
        `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      );
    }

    const { data, error } = await query;

    if (data && !error) {
      setPages(data);
    }

    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await (supabase as any)
      .from("doc_categories")
      .select("*")
      .order("display_order");

    if (data) {
      setCategories(data);
    }
  };

  const createNewPage = () => {
    const newPage: DocPage = {
      id: "",
      slug: "",
      title: "",
      description: "",
      content: "",
      category_id: categories[0]?.id || "",
      status: "draft",
      version: "1.0.0",
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
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const pageData = {
      ...selectedPage,
      updated_at: new Date().toISOString(),
    };

    if (selectedPage.id) {
      // Update existing page
      const { error } = await (supabase as any)
        .from("doc_pages")
        .update(pageData)
        .eq("id", selectedPage.id);

      if (!error) {
        // Create version history entry
        await (supabase as any).from("doc_versions").insert({
          page_id: selectedPage.id,
          version: selectedPage.version,
          title: selectedPage.title,
          content: selectedPage.content,
          content_type: "markdown",
          change_summary: "Updated via CMS",
        });
      }
    } else {
      // Create new page
      const { data, error } = await (supabase as any)
        .from("doc_pages")
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

  const [confirmDeletePageId, setConfirmDeletePageId] = useState<string | null>(null);
  const deletePage = (pageId: string) => {
    setConfirmDeletePageId(pageId);
  };

  const handleConfirmDeletePage = async () => {
    if (!confirmDeletePageId) return;
    await (supabase as any).from("doc_pages").delete().eq("id", confirmDeletePageId);
    loadPages();
    setSelectedPage(null);
    setConfirmDeletePageId(null);
  };

  const publishPage = async (pageId: string) => {
    await (supabase as any)
      .from("doc_pages")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", pageId);

    loadPages();
  };

  const unpublishPage = async (pageId: string) => {
    await (supabase as any)
      .from("doc_pages")
    return (
      <>
        <div className="flex h-screen bg-gray-50">
          {/* ...existing code... */}
        </div>
        {confirmDeletePageId && (
          <ConfirmDialog
            open={!!confirmDeletePageId}
            onOpenChange={(open) => !open && setConfirmDeletePageId(null)}
            title="Delete Page"
            description="Are you sure you want to delete this page?"
            confirmLabel="Delete"
            cancelLabel="Cancel"
            variant="destructive"
            onConfirm={handleConfirmDeletePage}
          />
        )}
      </>
    );
    loadPages();
  }
}
className = "inline-flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
  >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                      </button >

  <button
    onClick={savePage}
    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
  >
    <Save className="w-4 h-4" />
    <span>Save</span>
  </button>
                    </>
                  )}
                </div >
              </div >
            </div >

  {/* Editor Content */ }
  < div className = "flex-1 overflow-y-auto p-6" >
  {
    isEditing?(
                <div className = "max-w-4xl mx-auto space-y-6" >
        {/* Title */ }
        < div >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={selectedPage.title}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          title: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Page title"
                    />
                  </div>

    {/* Slug */ }
    < div >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={selectedPage.slug}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          slug: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="page-slug (auto-generated if empty)"
                    />
                  </div >

  {/* Description */ }
  < div >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={selectedPage.description}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description"
                    />
                  </div >

  {/* Category */ }
  < div >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={selectedPage.category_id}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          category_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div >

  {/* Content */ }
  < div >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content (Markdown) *
                    </label>
                    <textarea
                      value={selectedPage.content}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          content: e.target.value,
                        })
                      }
                      rows={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="# Page Content\n\nWrite your content in Markdown..."
                    />
                  </div >

  {/* Tags */ }
  < div >
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={selectedPage.tags.join(", ")}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          tags: e.target.value.split(",").map((t) => t.trim()),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="tag1, tag2, tag3"
                    />
                  </div >

  {/* Featured */ }
  < div className = "flex items-center gap-2" >
                    <input
                      type="checkbox"
                      id="featured"
                      checked={selectedPage.featured}
                      onChange={(e) =>
                        setSelectedPage({
                          ...selectedPage,
                          featured: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="featured"
                      className="text-sm font-medium text-gray-700"
                    >
                      Featured page
                    </label>
                  </div >
                </div >
              ) : (
  <div className="max-w-4xl mx-auto">
    <article className="prose prose-blue max-w-none">
      <h1>{selectedPage.title}</h1>
      {selectedPage.description && (
        <p className="lead">{selectedPage.description}</p>
      )}
      <SafeHtml html={selectedPage.content} />
    </article>
  </div>
)}
            </div >
          </>
        ) : (
  <div className="flex-1 flex items-center justify-center text-gray-500">
    <div className="text-center">
      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
      <p className="text-lg mb-2">No page selected</p>
      <p className="text-sm">
        Select a page from the list or create a new one
      </p>
    </div>
  </div>
)}
      </div >
    </div >
  );
};
