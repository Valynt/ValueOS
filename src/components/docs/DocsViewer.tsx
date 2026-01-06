/**
 * Documentation Viewer Component
 * 
 * Renders markdown content with syntax highlighting, copy buttons,
 * table of contents, and role-appropriate content filtering.
 */

import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Breadcrumb, DocSection, TableOfContents, UserRole } from './types';
import { DocsBreadcrumbs } from './DocsBreadcrumbs';
import { DocsTableOfContents } from './DocsTableOfContents';
import { DocsCopyButton } from './DocsCopyButton';
import { DocsRelatedLinks } from './DocsRelatedLinks';

interface DocsViewerProps {
  section: DocSection | null;
  userRole: UserRole;
  onNavigate: (_sectionId: string) => void;
}

export const DocsViewer: React.FC<DocsViewerProps> = ({
  section,
  userRole,
  onNavigate
}) => {
  const [showToc, setShowToc] = useState(true);
  const [activeHeading, setActiveHeading] = useState<string>('');

  // Generate table of contents from markdown
  const toc = useMemo(() => {
    if (!section?.content) return null;
    return generateTableOfContents(section.content);
  }, [section?.content]);

  // Generate breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!section) return [];
    return generateBreadcrumbs(section);
  }, [section]);

  // Filter content based on user role
  const filteredContent = useMemo(() => {
    if (!section?.content) return '';
    return filterContentByRole(section.content, userRole);
  }, [section?.content, userRole]);

  // Track active heading for ToC highlighting
  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('h2[id], h3[id]');
      let current = '';

      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        if (rect.top <= 100) {
          current = heading.id;
        }
      });

      setActiveHeading(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!section) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg">Select a topic to get started</p>
        </div>
      </div>
    );
  }

  const isTechnical = section.category === 'developer-guide' || section.category === 'api-reference';
  const showCodeExamples = userRole === 'developer' || userRole === 'admin';

  return (
    <div className="flex h-full bg-white">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Breadcrumbs */}
          <DocsBreadcrumbs breadcrumbs={breadcrumbs} onNavigate={onNavigate} />

          {/* Header */}
          <header className="mb-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {section.title}
                </h1>
                {section.description && (
                  <p className="text-xl text-gray-600 mb-4">
                    {section.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {section.estimatedTime && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {section.estimatedTime}
                    </span>
                  )}
                  {section.difficulty && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      section.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      section.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {section.difficulty}
                    </span>
                  )}
                  <span>
                    Updated {new Date(section.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Toggle ToC button (mobile) */}
              <button
                onClick={() => setShowToc(!showToc)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
                aria-label="Toggle table of contents"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </header>

          {/* Content */}
          <article className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom heading renderer with IDs for ToC
                h2: ({ node: _node, children, ...props }) => {
                  const id = slugify(children?.toString() || '');
                  return <h2 id={id} {...props}>{children}</h2>;
                },
                h3: ({ node: _node, children, ...props }) => {
                  const id = slugify(children?.toString() || '');
                  return <h3 id={id} {...props}>{children}</h3>;
                },
                // Code blocks with syntax highlighting and copy button
                code: ({ node: _node, inline, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const code = String(children).replace(/\n$/, '');

                  if (!inline && match) {
                    // Only show code blocks to appropriate users
                    if (!showCodeExamples && isTechnical) {
                      return (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
                          <p className="text-sm text-blue-800 mb-2">
                            💡 <strong>Developer Note:</strong> Code example available
                          </p>
                          <p className="text-sm text-blue-600">
                            Switch to developer view to see technical implementation details.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="relative group">
                        <DocsCopyButton code={code} />
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }

                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                // Custom link renderer for internal navigation
                a: ({ node: _node, href, children, ...props }) => {
                  // 🤖 HARDEN: Prevent XSS via javascript: links
                  const safeHref = href || '';
                  // eslint-disable-next-line no-script-url
                  if (safeHref.trim().toLowerCase().startsWith('javascript:')) {
                    console.warn('Blocked unsafe link:', safeHref);
                    return <span className="text-red-500 font-mono text-xs" title="Unsafe Link Blocked">[BLOCKED UNSAFE LINK]</span>;
                  }

                  if (safeHref.startsWith('./') || safeHref.startsWith('../')) {
                    const sectionId = extractSectionId(safeHref);
                    return (
                      <button
                        onClick={() => onNavigate(sectionId)}
                        className="text-blue-600 hover:text-blue-800 underline"
                        {...props}
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                // Custom blockquote for callouts
                blockquote: ({ node, children, ..._props }) => {
                  const text = node?.children?.[0]?.children?.[0]?.value || '';
                  const type = detectCalloutType(text);

                  return (
                    <div className={`border-l-4 p-4 my-4 rounded-r-lg ${
                      type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                      type === 'tip' ? 'bg-blue-50 border-blue-400' :
                      type === 'note' ? 'bg-gray-50 border-gray-400' :
                      'bg-gray-50 border-gray-300'
                    }`}>
                      {children}
                    </div>
                  );
                },
              }}
            >
              {filteredContent}
            </ReactMarkdown>
          </article>

          {/* Related Links */}
          {section.metadata?.relatedSections && (
            <DocsRelatedLinks
              relatedSections={section.metadata.relatedSections}
              onNavigate={onNavigate}
            />
          )}

          {/* Feedback Section */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Was this helpful?
              </h3>
              <p className="text-gray-600 mb-4">
                Let us know if you found this documentation useful.
              </p>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  👍 Yes
                </button>
                <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                  👎 No
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table of Contents Sidebar */}
      {toc && (
        <DocsTableOfContents
          toc={toc}
          activeHeading={activeHeading}
          isOpen={showToc}
          onClose={() => setShowToc(false)}
        />
      )}
    </div>
  );
};

// Helper functions

function generateTableOfContents(markdown: string): TableOfContents {
  const headings = markdown.match(/^#{2,3}\s+.+$/gm) || [];
  const items = headings.map(heading => {
    const level = heading.match(/^#+/)?.[0].length || 2;
    const title = heading.replace(/^#+\s+/, '');
    const id = slugify(title);
    return { id, title, level };
  });

  return { items };
}

function generateBreadcrumbs(section: DocSection): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [
    { label: 'Documentation', sectionId: 'overview-welcome' }
  ];

  const categoryLabels = {
    'overview': 'Overview',
    'user-guide': 'User Guide',
    'developer-guide': 'Developer Guide',
    'api-reference': 'API Reference'
  };

  breadcrumbs.push({
    label: categoryLabels[section.category],
    sectionId: `${section.category}-home`
  });

  breadcrumbs.push({
    label: section.title
  });

  return breadcrumbs;
}

function filterContentByRole(content: string, role: UserRole): string {
  // For non-technical users, simplify technical sections
  if (role === 'business' || role === 'executive') {
    // 🤖 HARDEN: Improve regex to catch backticks AND tildes, and variable length fences
    // Matches ``` or ~~~ (at least 3), optional params, content, closing fence
    // The [\s\S]*? is non-greedy match of body.
    content = content.replace(/([`~]{3,})[\s\S]*?\1/g, (_) => {
      return '> 💡 **Technical details available**: Contact your technical team for implementation details.';
    });
  }

  return content;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function extractSectionId(href: string): string {
  // Extract section ID from relative path
  const match = href.match(/([^/]+)\.md$/);
  return match ? match[1] : href;
}

function detectCalloutType(text: string): 'warning' | 'tip' | 'note' | 'default' {
  if (text.includes('⚠️') || text.includes('Warning')) return 'warning';
  if (text.includes('💡') || text.includes('Tip')) return 'tip';
  if (text.includes('Note')) return 'note';
  return 'default';
}

export default DocsViewer;
