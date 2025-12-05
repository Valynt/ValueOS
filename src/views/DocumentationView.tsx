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
  tags?: string[];
  featured?: boolean;
}

interface DocTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  template: string;
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
  const [view, setView] = useState<'home' | 'category' | 'page' | 'templates'>('home');
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [popularPages, setPopularPages] = useState<DocPage[]>([]);
  const [currentPage, setCurrentPage] = useState<DocPage | null>(null);
  const [currentCategory, setCurrentCategory] = useState<DocCategory | null>(null);
  const [categoryPages, setCategoryPages] = useState<DocPage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>(['Documentation']);
  const [templates] = useState<DocTemplate[]>([
    {
      id: 'lifecycle-playbook',
      name: 'Lifecycle Playbook',
      description: 'For Opportunity → Expansion workflows with inputs, steps, outputs, and escalation notes',
      icon: '🔄',
      template: `# [Lifecycle Stage] Playbook

## Overview
Brief description of this lifecycle stage and its objectives.

## Inputs Required
- Input 1: Description
- Input 2: Description
- Input 3: Description

## Process Steps
1. **Step 1**: Detailed description
2. **Step 2**: Detailed description
3. **Step 3**: Detailed description

## Expected Outputs
- Output 1: Description
- Output 2: Description
- Output 3: Description

## Escalation & Support
- **When to escalate**: Conditions
- **Who to contact**: Team/person
- **SLA**: Response time

## Related Resources
- [Link to related doc](#)
- [Link to related doc](#)
`,
    },
    {
      id: 'api-howto',
      name: 'API How-To',
      description: 'Prebuilt blocks for authentication, request/response examples, and error handling',
      icon: '🔌',
      template: `# [API Name] Integration Guide

## Authentication
\`\`\`bash
curl -X POST https://api.example.com/auth \\
  -H "Content-Type: application/json" \\
  -d '{"api_key": "your_api_key"}'
\`\`\`

## Request Format
\`\`\`json
{
  "param1": "value1",
  "param2": "value2"
}
\`\`\`

## Response Format
\`\`\`json
{
  "success": true,
  "data": {
    "result": "value"
  }
}
\`\`\`

## Error Handling
| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Invalid API key |
| 500 | Server Error | Internal error |

## Code Examples
### JavaScript
\`\`\`javascript
const response = await fetch('https://api.example.com/endpoint', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ param: 'value' })
});
\`\`\`
`,
    },
    {
      id: 'troubleshooting',
      name: 'Troubleshooting Guide',
      description: 'Triage table with symptoms, root causes, and verified fixes',
      icon: '🔧',
      template: `# [Feature/System] Troubleshooting Guide

## Common Issues

### Issue 1: [Problem Description]
**Symptoms:**
- Symptom 1
- Symptom 2

**Root Cause:**
Explanation of what causes this issue.

**Solution:**
1. Step 1
2. Step 2
3. Step 3

**Prevention:**
How to avoid this issue in the future.

---

### Issue 2: [Problem Description]
**Symptoms:**
- Symptom 1
- Symptom 2

**Root Cause:**
Explanation of what causes this issue.

**Solution:**
1. Step 1
2. Step 2
3. Step 3

**Prevention:**
How to avoid this issue in the future.

## Diagnostic Checklist
- [ ] Check system status
- [ ] Verify configuration
- [ ] Review logs
- [ ] Test connectivity
- [ ] Validate permissions

## Still Need Help?
Contact support at support@example.com
`,
    },
    {
      id: 'compliance-checklist',
      name: 'Compliance Checklist',
      description: 'Manifesto rule matrix with evidence links and approval history',
      icon: '✅',
      template: `# [Feature/Process] Compliance Checklist

## Manifesto Alignment

| Rule | Status | Evidence | Notes |
|------|--------|----------|-------|
| Value-First Principle | ✅ Pass | [Link](#) | Aligned with customer outcomes |
| Unified Language | ✅ Pass | [Link](#) | Consistent terminology |
| Provenance Tracking | ⚠️ Review | [Link](#) | Needs additional documentation |
| Integrity Controls | ✅ Pass | [Link](#) | All checks implemented |

## Persona Alignment
- **Economic Buyer**: Value proposition clear
- **Technical Buyer**: Implementation details provided
- **End User**: Usability validated

## Approval History
| Date | Approver | Status | Comments |
|------|----------|--------|----------|
| 2025-01-15 | John Doe | Approved | All requirements met |
| 2025-01-10 | Jane Smith | Requested Changes | Need more evidence |

## Next Review Date
[Date]

## Compliance Officer
[Name and contact]
`,
    },
    {
      id: 'release-runbook',
      name: 'Release Runbook',
      description: 'Deployment steps, rollback hooks, and verification tasks',
      icon: '🚀',
      template: `# [Release Version] Deployment Runbook

## Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Stakeholders notified
- [ ] Backup created

## Deployment Steps
1. **Prepare Environment**
   \`\`\`bash
   # Commands here
   \`\`\`

2. **Deploy Application**
   \`\`\`bash
   # Commands here
   \`\`\`

3. **Run Migrations**
   \`\`\`bash
   # Commands here
   \`\`\`

4. **Verify Deployment**
   \`\`\`bash
   # Commands here
   \`\`\`

## Verification Tasks
- [ ] Health check endpoint responding
- [ ] Database migrations applied
- [ ] Key features functional
- [ ] Monitoring alerts configured

## Rollback Procedure
If issues are detected:

1. **Stop Traffic**
   \`\`\`bash
   # Commands here
   \`\`\`

2. **Revert to Previous Version**
   \`\`\`bash
   # Commands here
   \`\`\`

3. **Verify Rollback**
   \`\`\`bash
   # Commands here
   \`\`\`

## Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Review metrics
- [ ] Update status page
- [ ] Send completion notification

## Contacts
- **On-Call Engineer**: [Name/Phone]
- **Release Manager**: [Name/Phone]
- **Escalation**: [Name/Phone]
`,
    },
  ]);

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
    setCurrentCategory(null);
    setBreadcrumbs(['Documentation']);
    announceToScreenReader('Returned to documentation home', 'polite');
  };

  const openCategory = async (category: DocCategory) => {
    setCurrentCategory(category);
    setView('category');
    setBreadcrumbs(['Documentation', category.name]);

    // Load pages in this category
    const { data } = await supabase
      .from('doc_pages')
      .select('*')
      .eq('category_id', category.id)
      .eq('status', 'published')
      .order('title');

    if (data) {
      setCategoryPages(data);
    }

    announceToScreenReader(`Viewing ${category.name} category`, 'polite');
  };

  const viewTemplates = () => {
    setView('templates');
    setBreadcrumbs(['Documentation', 'Templates']);
    announceToScreenReader('Viewing page templates', 'polite');
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
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
                Everything you need to get started, build, and succeed with our platform
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={viewTemplates}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  📄 View Templates
                </button>
                <button
                  onClick={() => {
                    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
                    searchInput?.focus();
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  🔍 Search Docs
                </button>
              </div>
            </div>

            {/* Categories Grid */}
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Browse by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow text-left w-full"
                    onClick={() => openCategory(category)}
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
                  </button>
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

        {view === 'category' && currentCategory && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <div className="flex items-center space-x-4 mb-4">
                <div className="text-5xl">{currentCategory.icon}</div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{currentCategory.name}</h2>
                  <p className="text-lg text-gray-600 mt-2">{currentCategory.description}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => openPage(page.slug)}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow text-left"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {page.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                    {page.description}
                  </p>
                  {page.tags && page.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {page.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {categoryPages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No pages in this category yet.</p>
              </div>
            )}
          </div>
        )}

        {view === 'templates' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Page Templates</h2>
              <p className="text-lg text-gray-600">
                Ready-to-use templates to accelerate your documentation authoring
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start space-x-4 mb-4">
                    <div className="text-4xl">{template.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {template.name}
                      </h3>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-4 mb-4 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {template.template.substring(0, 300)}...
                    </pre>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(template.template);
                      announceToScreenReader('Template copied to clipboard', 'polite');
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Copy Template
                  </button>
                </div>
              ))}
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
